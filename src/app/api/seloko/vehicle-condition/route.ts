import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { ApiResponse } from "@/lib/api-response";
import { withErrorHandler } from "@/lib/with-error-handler";
import { UnauthorizedError, ForbiddenError, ValidationError } from "@/lib/errors";
import { hasPermission } from "@/types";

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

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", APIKEY: apiKey },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
    const code = cause?.code ?? (err as { code?: string }).code ?? (err as Error).name;
    console.error(`${tag} fetch gagal`, { url, code, cause: cause?.message ?? (err as Error).message });
    return ApiResponse.error(`Gagal menghubungi Samsat (${code})`, 502);
  }

  const text = await res.text();
  let json: { status?: number | string; message?: string } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    // balasan bukan JSON; nilai dari status HTTP
  }
  const bodyStatus = Number(json?.status ?? res.status);
  const success = res.ok && bodyStatus < 400;
  console.info(`${tag} balasan HTTP ${res.status}, body=${text.slice(0, 200)} => ${success ? "BERHASIL" : "GAGAL"}`);

  if (!success) {
    return ApiResponse.error(json?.message ?? `Samsat membalas HTTP ${res.status}`, 502);
  }
  return ApiResponse.success({ samsatMessage: json?.message ?? null }, "Kondisi terkirim ke Samsat");
});
