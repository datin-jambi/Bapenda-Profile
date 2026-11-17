// Satu-satunya tempat logika cek pajak kendaraan (Samsat PKB).
// Dipakai oleh semua halaman cek pajak. Aturan: lihat docs/cek-pajak.md.
// Dijalankan di browser: fetch langsung ke API Samsat memakai NEXT_PUBLIC_PKB_API_*.

export type KendaraanData = {
  no_polisi: string;
  merek?: { kode: number; nama: string };
  nm_merek_kb: string;
  nm_model_kb: string;
  nm_jenis_kb: string;
  th_rakitan: string;
  warna_kb: string;
  jumlah_cc: number;
  tg_akhir_pkb: string;
  tg_akhir_stnk: string;
  bbm?: { nama: string };
  njkb?: { nilai_jual: string };
};

export type PajakRincian = {
  periode: { periode: string; total_bulan_telat: number };
  pkb: { pokok: string; denda: string };
  is_opsen: boolean;
  opsen?: { opsen: string; denda_opsen: string };
  total: string;
};

export type PajakData = {
  terakhir_bayar: string;
  jarak: { tahun: number; bulan: number };
  tagihan: {
    total: { grand_total: string; pkb: { pokok: string; denda: string }; opsen: { pokok: string; denda: string } };
    rincian: PajakRincian[];
  };
};

export type JRTarifItem = {
  keterangan: string;
  kartu_jr: number;
  pokok_jr: number;
  denda_jr: number;
  subtotal: number;
};

export type JRData = {
  total_tarif: { total: number; pokok_jr: number; kartu_jr: number; denda_jr: number };
  tarif_per_tahun: JRTarifItem[];
};

export type PNBPData = {
  pnbp: {
    total: string;
    stnk?: { status: boolean; nominal: string };
    tnkb?: { status: boolean; nominal: string };
  };
};

export type PkbBundle = {
  kendaraan: KendaraanData;
  pajak: PajakData | null;
  jr: JRData | null;
  pnbp: PNBPData | null;
};

export type TagihanInfo = {
  terakhirBayar?: string;
  jatuhTempo?: string;
  grandTotal?: string;
  tahunTelat?: number;
  bulanTelat?: number;
} | null;

export type CheckResult = {
  licensePlate: string;
  status: "Lunas" | "Belum Lunas";
  kendaraan: {
    merek: string;
    model: string;
    jenis: string;
    tahun: string;
    warna: string;
    cc: number;
    bbm?: string;
    njkb?: string;
    tgAkhirPkb: string;
    tgAkhirStnk: string;
  };
  tagihan: TagihanInfo;
  checkedAt: string;
};

const PKB_HOST = process.env.NEXT_PUBLIC_PKB_API_HOST;
const PKB_TOKEN = process.env.NEXT_PUBLIC_PKB_API_TOKEN;

const PKB_PATHS = {
  "kendaraan-detail": "/kendaraan/detail",
  "kendaraan-pnbp": "/kendaraan/pnbp",
  "pajak-detail": "/pajak/detail",
  "jr-detail": "/jr/detail",
} as const;

export function normalizeNopol(raw: string): string {
  const val = raw.trim().toUpperCase().replace(/\s+/g, " ");
  // Sudah ada prefix plat (1-2 huruf diikuti spasi atau angka)
  if (/^[A-Z]{1,2}[\s\d]/.test(val)) return val;
  return "BH " + val;
}

export function parseRupiah(str?: string): number {
  if (!str || str === "-") return 0;
  const cleaned = str.replace(/[^0-9,.]/g, "").replace(/\./g, "").replace(",", ".");
  return Math.round(parseFloat(cleaned) || 0);
}

/** Tagihan baru ditampilkan bila jatuh tempo PKB <= 3 bulan dari sekarang. */
export function shouldShowTagihan(tgAkhirPkb: string): boolean {
  const batas = new Date();
  batas.setMonth(batas.getMonth() + 3);
  return new Date(tgAkhirPkb) <= batas;
}

export function isSudahBayar(pajak: PajakData): boolean {
  return parseRupiah(pajak.tagihan.total.grand_total) === 0 || pajak.jarak.bulan === 0;
}

async function pkbCall<T>(endpoint: keyof typeof PKB_PATHS, nopol: string): Promise<T | null> {
  if (!PKB_HOST || !PKB_TOKEN) throw new Error("NEXT_PUBLIC_PKB_API_HOST / NEXT_PUBLIC_PKB_API_TOKEN belum di-set");
  const url = `${PKB_HOST}${PKB_PATHS[endpoint]}?nopol=${encodeURIComponent(nopol)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${PKB_TOKEN}` } });
  const text = await res.text();

  let json: { status?: boolean; message?: string; data?: T };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Respons ${endpoint} tidak valid (HTTP ${res.status})`);
  }
  if (json.status && json.data) return json.data;
  // 400/404 = nopol tidak terdaftar. Selain itu = gangguan.
  if (res.status === 400 || res.status === 404) return null;
  throw new Error(`API Samsat (${endpoint}) HTTP ${res.status}: ${json.message ?? "tanpa pesan"}`);
}

/**
 * Ambil data kendaraan. Detail tagihan (pajak, JR, PNBP) hanya diambil bila
 * tagihan sudah tampil (lihat shouldShowTagihan). Melempar Error bila gagal.
 */
export async function fetchPkbBundle(licensePlate: string): Promise<PkbBundle> {
  const nopol = normalizeNopol(licensePlate);
  const kendaraan = await pkbCall<KendaraanData>("kendaraan-detail", nopol);
  if (!kendaraan) throw new Error("Data kendaraan tidak ditemukan");

  if (!shouldShowTagihan(kendaraan.tg_akhir_pkb)) {
    return { kendaraan, pajak: null, jr: null, pnbp: null };
  }
  const [pajak, jr, pnbp] = await Promise.all([
    pkbCall<PajakData>("pajak-detail", nopol),
    pkbCall<JRData>("jr-detail", nopol),
    pkbCall<PNBPData>("kendaraan-pnbp", nopol),
  ]);
  return { kendaraan, pajak, jr, pnbp };
}

/** Status dan total tagihan dari satu bundle. Aturan sama untuk semua halaman. */
export function hitungStatus(bundle: PkbBundle): { status: "Lunas" | "Belum Lunas"; tagihan: TagihanInfo } {
  const { kendaraan, pajak, jr, pnbp } = bundle;

  if (!shouldShowTagihan(kendaraan.tg_akhir_pkb)) {
    return { status: "Lunas", tagihan: { jatuhTempo: kendaraan.tg_akhir_pkb, grandTotal: "0" } };
  }
  if (!pajak || isSudahBayar(pajak)) {
    return {
      status: "Lunas",
      tagihan: {
        terakhirBayar: pajak?.terakhir_bayar,
        grandTotal: "0",
        tahunTelat: pajak?.jarak.tahun,
        bulanTelat: pajak?.jarak.bulan,
      },
    };
  }
  const totalPkb = parseRupiah(pajak.tagihan.total.grand_total);
  const totalJr = jr?.total_tarif.total ?? 0;
  const totalPnbp = parseRupiah(pnbp?.pnbp.total);
  return {
    status: "Belum Lunas",
    tagihan: {
      terakhirBayar: pajak.terakhir_bayar,
      jatuhTempo: kendaraan.tg_akhir_pkb,
      grandTotal: String(totalPkb + totalJr + totalPnbp),
      tahunTelat: pajak.jarak.tahun,
      bulanTelat: pajak.jarak.bulan,
    },
  };
}

/** Entry point cek pajak untuk halaman: nopol -> hasil siap tampil. */
export async function checkPajakClient(licensePlate: string): Promise<CheckResult> {
  const bundle = await fetchPkbBundle(licensePlate);
  const { status, tagihan } = hitungStatus(bundle);
  const k = bundle.kendaraan;
  return {
    licensePlate: k.no_polisi,
    status,
    kendaraan: {
      merek: k.merek?.nama ?? k.nm_merek_kb ?? "-",
      model: k.nm_model_kb,
      jenis: k.nm_jenis_kb,
      tahun: k.th_rakitan,
      warna: k.warna_kb,
      cc: k.jumlah_cc,
      bbm: k.bbm?.nama,
      njkb: k.njkb?.nilai_jual,
      tgAkhirPkb: k.tg_akhir_pkb,
      tgAkhirStnk: k.tg_akhir_stnk,
    },
    tagihan,
    checkedAt: new Date().toISOString(),
  };
}
