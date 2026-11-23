import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { ApiResponse } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/with-error-handler";
import { UnauthorizedError, ForbiddenError, ValidationError } from "@/lib/errors";
import { hasPermission } from "@/types";
import { request as httpsRequest } from "node:https";
import { rootCertificates } from "node:tls";
import { PKB_CA_PEM } from "@/lib/pkb-ca";

/**
 * Proxy kirim kondisi kendaraan ke API Samsat (insert_kondisi.php).
 *
 * Browser memanggil route ini (same-origin, tanpa CORS). Server yang memanggil
 * Samsat dengan APIKEY, sehingga key tidak ikut ke bundle browser.
 */

/** Kode `status_kondisi` yang berpasangan dengan tiap `keterangan_kondisi`. */
const CONDITION_STATUS_CODE: Record<string, string> = {
  Baik: "01",
  Rusak: "02",
  "Rusak berat": "03",
  "Tidak sesuai kondisi": "04",
  Lainnya: "05",
};

const TIMEOUT_MS = Number(process.env.VEHICLE_CONDITION_TIMEOUT_MS) || 10_000;

/**
 * Node di image production lama tidak memuat GTS Root R4, padahal jambisamsat.net
 * memakai chain WE1 <- GTS Root R4 ("unable to verify the first certificate").
 * Sama seperti src/lib/pkb.ts, CA publik GTS ditambahkan eksplisit. Chain tetap
 * diverifikasi penuh (bukan rejectUnauthorized: false).
 * ponytail: hapus PKB_CA_PEM dari sini begitu image memakai Node yang memuat GTS Root R4.
 */
const CA_BUNDLE = [...rootCertificates, PKB_CA_PEM];

function postJson(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
        ca: CA_BUNDLE,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (buf += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: buf }));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timeout menghubungi Samsat")));
    req.on("error", reject);
    req.end(body);
  });
}

const bodySchema = z.object({
  licensePlate: z.string().trim().min(1, "Nomor polisi wajib diisi").max(15),
  condition: z.enum(["Baik", "Rusak", "Rusak berat", "Tidak sesuai kondisi", "Lainnya"]),
  checkedAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
});

/** Tanggal lokal WIB (YYYY-MM-DD), bukan UTC. */
function toJakartaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await getAuthUser();
  if (!user) throw new UnauthorizedError();
  if (!hasPermission(user.role, "cek:pajak")) throw new ForbiddenError("Tidak memiliki akses");

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new ValidationError("Data tidak valid", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }
  const { licensePlate, condition, checkedAt } = parsed.data;

  // Nama server-only diutamakan; fallback ke nama NEXT_PUBLIC_ yang sudah ada di .env.
  const url = process.env.VEHICLE_CONDITION_URL ?? process.env.NEXT_PUBLIC_VEHICLE_CONDITION ?? "";
  const apiKey = process.env.VEHICLE_CONDITION_APIKEY ?? process.env.NEXT_PUBLIC_APIKEY_VEHICLE_CONDITION ?? "";
  const tag = `[vehicle-condition] ${licensePlate}`;

  if (!url || !apiKey) {
    console.warn(`${tag} SKIP: URL atau APIKEY Samsat belum di-set di server`);
    return ApiResponse.error("Integrasi kondisi belum dikonfigurasi", 503);
  }

  const payload = {
    no_polisi: licensePlate.toUpperCase(),
    keterangan_kondisi: condition,
    status_kondisi: CONDITION_STATUS_CODE[condition],
    tgl: toJakartaDate(new Date(checkedAt)),
    user_petugas: user.name ?? user.email,
  };

  let res: { status: number; text: string };
  try {
    res = await postJson(url, { "Content-Type": "application/json", APIKEY: apiKey }, JSON.stringify(payload));
  } catch (err) {
    const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
    const code = cause?.code ?? (err as { code?: string }).code ?? (err as Error).name;
    console.error(`${tag} fetch gagal`, { url, code, cause: cause?.message ?? (err as Error).message });
    return ApiResponse.error(`Gagal menghubungi Samsat (${code})`, 502);
  }

  const text = res.text;
  let json: { status?: number | string; message?: string } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    // balasan bukan JSON; nilai dari status HTTP
  }
  const bodyStatus = Number(json?.status ?? res.status);
  const success = res.status >= 200 && res.status < 300 && bodyStatus < 400;
  console.info(`${tag} balasan HTTP ${res.status}, body=${text.slice(0, 200)} => ${success ? "BERHASIL" : "GAGAL"}`);

  if (!success) {
    return ApiResponse.error(json?.message ?? `Samsat membalas HTTP ${res.status}`, 502);
  }
  return ApiResponse.success({ samsatMessage: json?.message ?? null }, "Kondisi terkirim ke Samsat");
});
