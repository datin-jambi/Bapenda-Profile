/**
 * Kirim kondisi kendaraan ke Samsat lewat route server `/api/seloko/vehicle-condition`.
 * Browser tidak memanggil Samsat langsung (CORS dan key tidak boleh terbuka di client).
 * Dipanggil setelah log tersimpan; kegagalan di sini tidak membatalkan log.
 */
import api from "@/lib/axios";

export type ConditionSyncResult = {
  skipped?: boolean;
  success: boolean;
  message: string;
};

export async function syncVehicleConditionClient(params: {
  licensePlate: string;
  condition: string | null;
}): Promise<ConditionSyncResult> {
  const tag = `[vehicle-condition] ${params.licensePlate}`;

  if (!params.condition) {
    console.warn(`${tag} SKIP: kondisi kosong`);
    return { skipped: true, success: false, message: "Kondisi belum dipilih, tidak dikirim ke Samsat" };
  }

  try {
    const res = await api.post<{ message?: string }>("/seloko/vehicle-condition", {
      licensePlate: params.licensePlate,
      condition: params.condition,
      checkedAt: new Date().toISOString(),
    });
    console.info(`${tag} BERHASIL: ${res.data?.message ?? "terkirim"}`);
    return { success: true, message: res.data?.message ?? "Kondisi terkirim ke Samsat" };
  } catch (err) {
    const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
    const message = e.response?.data?.message ?? e.message ?? "Gagal menghubungi server";
    console.error(`${tag} GAGAL (HTTP ${e.response?.status ?? "-"}): ${message}`);
    return { success: false, message };
  }
}
