/**
 * Sinkronisasi kondisi kendaraan ke API Samsat (insert_kondisi.php).
 *
 * Dipanggil setelah log pengecekan tersimpan di database kita — database tetap
 * jadi sumber kebenaran, jadi kegagalan API ini TIDAK membatalkan penyimpanan
 * log (petugas tidak boleh kehilangan hasil pengecekan hanya karena API luar
 * sedang down). Hasilnya dikembalikan ke klien agar bisa ditampilkan sebagai
 * peringatan.
 */

/** Kode `status_kondisi` yang berpasangan dengan tiap `keterangan_kondisi`. */
export const CONDITION_STATUS_CODE: Record<string, string> = {
  Baik: "01",
  Rusak: "02",
  "Rusak berat": "03",
  "Tidak sesuai kondisi": "04",
  Lainnya: "05",
};

export type ConditionSyncResult = {
  /** true bila API tidak dipanggil (env kosong / kondisi tidak dikenal). */
  skipped?: boolean;
  success: boolean;
  message: string;
  httpStatus?: number;
};

export type ConditionSyncPayload = {
  no_polisi: string;
  keterangan_kondisi: string;
  status_kondisi: string;
  tgl: string;
  user_petugas: string;
};

/**
 * Batas tunggu API Samsat. 5 detik: cukup untuk insert sederhana, tapi tidak
 * membuat petugas menunggu lama saat API sedang bermasalah. Bisa ditimpa env.
 */
const TIMEOUT_MS = Number(process.env.VEHICLE_CONDITION_TIMEOUT_MS) || 5_000;

/** URL & API key. Nama non-NEXT_PUBLIC_ diutamakan agar key tidak ikut ke bundle browser. */
function readConfig() {
  return {
    url: process.env.VEHICLE_CONDITION_URL ?? process.env.NEXT_PUBLIC_VEHICLE_CONDITION ?? "",
    apiKey:
      process.env.VEHICLE_CONDITION_APIKEY ?? process.env.NEXT_PUBLIC_APIKEY_VEHICLE_CONDITION ?? "",
  };
}

/** Tanggal lokal WIB (YYYY-MM-DD) — bukan UTC, supaya tidak mundur sehari. */
export function toJakartaDate(date: Date): string {
  // en-CA menghasilkan format YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Susun body sesuai kontrak API Samsat. */
export function buildConditionPayload(params: {
  licensePlate: string;
  condition: string;
  checkedAt: Date;
  officerName: string;
}): ConditionSyncPayload {
  return {
    no_polisi: params.licensePlate.trim().toUpperCase(),
    keterangan_kondisi: params.condition,
    status_kondisi: CONDITION_STATUS_CODE[params.condition],
    tgl: toJakartaDate(params.checkedAt),
    user_petugas: params.officerName,
  };
}

export async function syncVehicleCondition(params: {
  licensePlate: string;
  condition: string | null;
  checkedAt: Date;
  officerName: string;
}): Promise<ConditionSyncResult> {
  const { url, apiKey } = readConfig();

  if (!url || !apiKey) {
    return { skipped: true, success: false, message: "Integrasi kondisi belum dikonfigurasi" };
  }

  if (!params.condition || !CONDITION_STATUS_CODE[params.condition]) {
    return {
      skipped: true,
      success: false,
      message: `Kondisi "${params.condition ?? "-"}" tidak dikenal, tidak dikirim ke Samsat`,
    };
  }

  const payload = buildConditionPayload({
    licensePlate: params.licensePlate,
    condition: params.condition,
    checkedAt: params.checkedAt,
    officerName: params.officerName,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", APIKEY: apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let json: { status?: number | string | boolean; message?: string; success?: boolean } | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Balasan bukan JSON — tetap dinilai dari status HTTP.
    }

    const bodyStatus =
      typeof json?.status === "number"
        ? json.status
        : typeof json?.status === "string" && /^\d+$/.test(json.status)
          ? Number(json.status)
          : typeof json?.success === "boolean"
            ? json.success
              ? 200
              : 500
            : res.ok
              ? 200
              : 500;

    const success = res.ok && Number(bodyStatus) < 400;

    return {
      success,
      httpStatus: res.status,
      message:
        json?.message ??
        (success ? "Kondisi terkirim ke Samsat" : `Samsat membalas HTTP ${res.status}`),
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      success: false,
      message: aborted
        ? `Timeout ${TIMEOUT_MS / 1000}s menghubungi API Samsat`
        : err instanceof Error
          ? err.message
          : "Gagal menghubungi API Samsat",
    };
  } finally {
    clearTimeout(timer);
  }
}
