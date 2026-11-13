import { request as httpsRequest } from "node:https";
import { checkServerIdentity, rootCertificates } from "node:tls";
import fs from "node:fs";
import { PkbUpstreamError } from "./errors";
import { PKB_CA_PEM } from "./pkb-ca";

// api-pkb.jambisamsat.net menyajikan sertifikat untuk seloko.jambisamsat.net,
// sehingga browser menolaknya (ERR_CERT_COMMON_NAME_INVALID) dan fetch biasa
// gagal. Nama itu diterima eksplisit di sini — chain tetap diverifikasi penuh,
// jadi ini bukan `rejectUnauthorized: false`.
// ponytail: hapus CERT_CN dan pakai fetch() biasa begitu sertifikat diperbaiki.
const CERT_CN = "seloko.jambisamsat.net";
const HOST = process.env.PKB_API_HOST;
const TOKEN = process.env.PKB_API_TOKEN;

// Node memakai CA bundle yang dikompilasi ke binary, bukan store OS — di image
// lama GTS Root R4 tidak ada di situ ("unable to verify the first certificate").
// Cloudflare menyajikan chain berbeda per PoP (GTS / Let's Encrypt / Sectigo),
// jadi pakai gabungan: root bawaan Node + bundle CA sistem + pin GTS sebagai
// cadangan bila ca-certificates tidak terpasang di image.
const SYSTEM_CA = ["/etc/ssl/certs/ca-certificates.crt", "/etc/pki/tls/certs/ca-bundle.crt", "/etc/ssl/cert.pem"]
  .map((p) => {
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      return "";
    }
  })
  .find(Boolean) ?? "";
const CA_BUNDLE = [...rootCertificates, PKB_CA_PEM, ...(SYSTEM_CA ? [SYSTEM_CA] : [])];

/** Endpoint API Samsat yang boleh dipanggil (slug -> path upstream). */
export const PKB_ENDPOINTS = {
  "kendaraan-detail": "/kendaraan/detail",
  "kendaraan-pnbp": "/kendaraan/pnbp",
  "pajak-detail": "/pajak/detail",
  "jr-detail": "/jr/detail",
} as const;

export type PkbEndpoint = keyof typeof PKB_ENDPOINTS;

export const isPkbEndpoint = (v: string): v is PkbEndpoint => v in PKB_ENDPOINTS;

/** Ambil body mentah + status HTTP dari API Samsat. Melempar bila koneksi gagal. */
export function pkbFetchRaw(
  endpoint: PkbEndpoint,
  nopol: string
): Promise<{ status: number; body: string }> {
  if (!HOST || !TOKEN) throw new PkbUpstreamError("PKB API belum dikonfigurasi");

  const url = new URL(HOST + PKB_ENDPOINTS[endpoint]);
  url.searchParams.set("nopol", nopol);

  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        // Root bawaan Node + bundle CA sistem + pin GTS (lihat CA_BUNDLE).
        ca: CA_BUNDLE,
        checkServerIdentity: (_host, cert) => checkServerIdentity(CERT_CN, cert),
        timeout: 20_000,
      },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (buf += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: buf }));
        // Tanpa handler ini, socket error di tengah respons = uncaught exception.
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timeout menghubungi API Samsat")));
    req.on("error", (err) => {
      // Diagnostik: cert apa yang sebenarnya disajikan upstream ke container ini.
      const peer = (req.socket as import("node:tls").TLSSocket | null)?.getPeerCertificate?.();
      if (peer?.issuer) {
        console.error(`[pkb] peer cert: subject="${peer.subject?.CN}" issuer="${peer.issuer?.CN ?? peer.issuer?.O}" kode=${(err as NodeJS.ErrnoException).code ?? "-"}`);
      }
      reject(err);
    });
    req.end();
  });
}

/**
 * Versi terparsing: `data` bila sukses, `null` bila kendaraan memang tidak ada.
 * Kegagalan koneksi/konfigurasi dilempar sebagai PkbUpstreamError (502) supaya
 * tidak menyamar jadi "data tidak ditemukan" (404).
 */
export async function pkbFetch<T>(endpoint: PkbEndpoint, nopol: string): Promise<T | null> {
  let res: { status: number; body: string };
  try {
    res = await pkbFetchRaw(endpoint, nopol);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[pkb] ${endpoint} ${nopol} gagal: ${reason}`);
    throw new PkbUpstreamError(`Gagal menghubungi API Samsat: ${reason}`);
  }

  let json: { status?: boolean; message?: string; data?: T };
  try {
    json = JSON.parse(res.body);
  } catch {
    console.error(`[pkb] ${endpoint} ${nopol} respons bukan JSON (HTTP ${res.status}): ${res.body.slice(0, 200)}`);
    throw new PkbUpstreamError(`Respons API Samsat tidak valid (HTTP ${res.status})`);
  }

  if (json.status && json.data) return json.data;

  // 400/404 = nopol tidak terdaftar. Selain itu (401 token, 5xx) = gangguan upstream.
  if (res.status === 400 || res.status === 404) return null;

  console.error(`[pkb] ${endpoint} ${nopol} HTTP ${res.status}: ${json.message ?? res.body.slice(0, 200)}`);
  throw new PkbUpstreamError(
    `API Samsat menolak permintaan (HTTP ${res.status}): ${json.message ?? "tanpa pesan"}`
  );
}
