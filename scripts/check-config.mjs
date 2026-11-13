// Cek konfigurasi saat container start — hasilnya muncul di `docker compose logs`.
// Tidak pernah mencetak secret: URL hanya host:port/db, secret hanya panjangnya.
// Tidak menghentikan start; hanya melapor. Jalankan manual: node scripts/check-config.mjs
import fs from "node:fs";
import tls from "node:tls";
import { PrismaClient } from "@prisma/client";

const env = process.env;
let problems = 0;
const line = (tag, name, info = "") => console.log(`  [${tag}] ${name.padEnd(34)} ${info}`);
const bad = (name, info) => { problems++; line("GAGAL", name, info); };

function urlInfo(v) {
  try {
    const u = new URL(v);
    return `${u.hostname}:${u.port || "(default)"}${u.pathname}`;
  } catch {
    return "(format URL tidak valid)";
  }
}

async function reach(name, url) {
  try {
    const t = Date.now();
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    line("OK", name, `HTTP ${res.status} (${Date.now() - t} ms) ${urlInfo(url)}`);
  } catch (e) {
    bad(name, `tidak terjangkau: ${e.cause?.code || e.message} ${urlInfo(url)}`);
  }
}

/** CA bundle sistem, dipakai juga oleh src/lib/pkb.ts. */
function systemCa() {
  for (const p of ["/etc/ssl/certs/ca-certificates.crt", "/etc/pki/tls/certs/ca-bundle.crt", "/etc/ssl/cert.pem"]) {
    try { return fs.readFileSync(p, "utf8"); } catch { /* coba path berikutnya */ }
  }
  return "";
}

/**
 * Cek TLS ke upstream dengan store default Node DAN dengan CA sistem, sambil
 * mencetak chain yang benar-benar disajikan. Ini yang membedakan "chain tidak
 * lengkap" dari "root tidak ada di store" saat verifikasi gagal.
 */
async function tlsProbe(name, url) {
  const u = new URL(url);
  const ca = systemCa();
  const probe = (opts) =>
    new Promise((resolve) => {
      const s = tls.connect(
        { host: u.hostname, port: Number(u.port || 443), servername: u.hostname, ...opts },
        () => {
          const chain = [];
          let cur = s.getPeerCertificate(true);
          while (cur?.subject) {
            chain.push(`${cur.subject.CN ?? cur.subject.O} <- ${cur.issuer?.CN ?? cur.issuer?.O}`);
            if (cur.issuerCertificate === cur) break;
            cur = cur.issuerCertificate;
          }
          resolve({ ok: s.authorized, err: s.authorizationError, chain });
          s.end();
        }
      );
      s.setTimeout(5000, () => { s.destroy(); resolve({ ok: false, err: "timeout", chain: [] }); });
      s.on("error", (e) => resolve({ ok: false, err: e.code || e.message, chain: [] }));
    });

  const sys = await probe(ca ? { ca } : {});
  const chainTxt = sys.chain.length ? sys.chain.join(" | ") : "(tidak ada chain)";
  if (sys.ok) line("OK", name, `TLS terverifikasi (CA sistem) ${urlInfo(url)}`);
  else bad(name, `TLS gagal: ${sys.err} | chain: ${chainTxt} ${urlInfo(url)}`);
  line("INFO", `${name} (store Node)`, sys.ok ? "OK" : `gagal: ${sys.err}`);
  line("INFO", `${name} (chain)`, chainTxt);
}

async function db(name, url) {
  if (!url) return;
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const t = Date.now();
    await prisma.$queryRawUnsafe("SELECT 1");
    line("OK", name, `tersambung (${Date.now() - t} ms) ${urlInfo(url)}`);
  } catch (e) {
    bad(name, `${String(e.message).trim().split("\n").pop()} ${urlInfo(url)}`);
  } finally {
    await prisma.$disconnect();
  }
}

console.log("==================== CEK KONFIGURASI ====================");
console.log(`  Waktu    : ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`);
console.log(`  NODE_ENV : ${env.NODE_ENV}   PORT: ${env.PORT}   Node: ${process.version}`);

console.log("-- Variabel runtime (.env)");
const urls = ["DATABASE_URL", "IMAGEKIT_URL_ENDPOINT", "PKB_API_HOST"];
const optionalUrls = ["DIRECT_URL"];
const secrets = ["JWT_SECRET", "JWT_REFRESH_SECRET", "IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY", "PKB_API_TOKEN"];
const plain = ["JWT_EXPIRES_IN", "JWT_REFRESH_EXPIRES_IN"];
for (const k of urls) env[k] ? line("OK", k, urlInfo(env[k])) : bad(k, "KOSONG");
// DIRECT_URL hanya perlu bila migrasi butuh koneksi langsung (mis. Supabase).
for (const k of optionalUrls) env[k] ? line("OK", k, urlInfo(env[k])) : line("INFO", k, "kosong — tidak dipakai");
for (const k of secrets) {
  if (!env[k]) bad(k, "KOSONG");
  else if (k.startsWith("JWT") && env[k].length < 32) bad(k, `terlalu pendek (${env[k].length} karakter, min 32)`);
  else line("OK", k, `terisi (${env[k].length} karakter)`);
}
for (const k of plain) env[k] ? line("OK", k, env[k]) : line("INFO", k, "kosong, pakai default kode");

// NEXT_PUBLIC_* tertanam di bundle saat build — nilai runtime tidak berpengaruh.
console.log("-- NEXT_PUBLIC_* tertanam saat build (ubah = build ulang)");
let built = {};
try {
  for (const l of fs.readFileSync("./build-public-env", "utf8").split("\n")) {
    const i = l.indexOf("=");
    if (i > 0) built[l.slice(0, i)] = l.slice(i + 1);
  }
} catch {
  line("INFO", "build-public-env", "file tidak ada, lewati");
  built = null;
}
if (built) {
  for (const k of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_APP_NAME", "NEXT_PUBLIC_PLATE_API_URL",
    "NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT", "NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY", "NEXT_PUBLIC_COMMIT_SHA"]) {
    const v = built[k];
    if (!v) { k === "NEXT_PUBLIC_COMMIT_SHA" ? line("INFO", k, "kosong") : bad(k, "KOSONG di build"); continue; }
    if (env[k] && env[k] !== v) bad(k, `beda dengan .env sekarang — build ulang. build="${v}"`);
    else line("OK", k, v);
  }
}

console.log("-- Koneksi");
await db("DB DATABASE_URL (app)", env.DATABASE_URL);
await db("DB DIRECT_URL (migrasi)", env.DIRECT_URL);
if (env.PKB_API_HOST) await tlsProbe("PKB_API_HOST", env.PKB_API_HOST);
if (env.IMAGEKIT_URL_ENDPOINT) await reach("IMAGEKIT_URL_ENDPOINT", env.IMAGEKIT_URL_ENDPOINT);

console.log(problems
  ? `==================== ${problems} MASALAH — cek baris [GAGAL] di atas ====================`
  : "==================== SEMUA OK ====================");
