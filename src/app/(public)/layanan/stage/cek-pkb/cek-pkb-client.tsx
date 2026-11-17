"use client";

import { useState, useRef } from "react";
import { Search, AlertCircle, CheckCircle, Clock, Info, Download, Eye, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchPkbBundle, normalizeNopol, parseRupiah, isSudahBayar, shouldShowTagihan, type PkbBundle } from "@/lib/pkb-client";


// ─── Types ────────────────────────────────────────────────────────────────────

interface KendaraanData {
  no_polisi: string;
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
  lokasi_transaksi_terakhir?: { nama: string };
}

interface PajakRincian {
  periode: { periode: string; total_bulan_telat: number };
  pkb: { pokok: string; denda: string };
  is_opsen: boolean;
  opsen?: { opsen: string; denda_opsen: string };
  total: string;
}

interface PajakData {
  terakhir_bayar: string;
  jarak: { tahun: number; bulan: number };
  tagihan: {
    total: { grand_total: string; pkb: { pokok: string; denda: string }; opsen: { pokok: string; denda: string } };
    rincian: PajakRincian[];
  };
}

interface JRTarifItem {
  keterangan: string;
  kartu_jr: number;
  pokok_jr: number;
  denda_jr: number;
  subtotal: number;
}

interface JRData {
  total_tarif: { total: number; pokok_jr: number; kartu_jr: number; denda_jr: number };
  tarif_per_tahun: JRTarifItem[];
}

interface PNBPData {
  pnbp: {
    total: string;
    stnk?: { status: boolean; nominal: string };
    tnkb?: { status: boolean; nominal: string };
  };
}

interface AllData {
  kendaraan: KendaraanData;
  pajak: PajakData | null;
  jr: JRData | null;
  pnbp: PNBPData | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(str?: string | null) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatRupiah(val: number | string) {
  const n = typeof val === "string" ? Number(String(val).replace(/[^0-9]/g, "")) : val;
  return "Rp " + Number(n).toLocaleString("id-ID");
}

// ─── Invoice Generator (client-side, returns HTML string) ────────────────────

function buildInvoiceHtml(data: AllData, grandTotal: number): string {
  const { kendaraan, pajak, jr, pnbp } = data;
  const now = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const rincianPKBRows = pajak?.tagihan.rincian.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f9"}">
      <td style="padding:5px 8px">${item.periode.periode}</td>
      <td style="padding:5px 8px">${item.periode.total_bulan_telat} bln</td>
      <td style="padding:5px 8px;text-align:right">${item.pkb.pokok}</td>
      <td style="padding:5px 8px;text-align:right;color:#dc2626">${item.pkb.denda}</td>
      <td style="padding:5px 8px;text-align:right">${item.is_opsen ? item.opsen?.opsen ?? "-" : "-"}</td>
      <td style="padding:5px 8px;text-align:right;color:#dc2626">${item.opsen?.denda_opsen ?? "-"}</td>
      <td style="padding:5px 8px;text-align:right;font-weight:600">${item.total}</td>
    </tr>`).join("") ?? "";

  const rincianJRRows = jr?.tarif_per_tahun.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f9"}">
      <td style="padding:5px 8px">${item.keterangan}</td>
      <td style="padding:5px 8px;text-align:right">${formatRupiah(item.kartu_jr + item.pokok_jr)}</td>
      <td style="padding:5px 8px;text-align:right;color:#dc2626">${formatRupiah(item.denda_jr)}</td>
      <td style="padding:5px 8px;text-align:right;font-weight:600">${formatRupiah(item.subtotal)}</td>
    </tr>`).join("") ?? "";

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Invoice PKB - ${kendaraan.no_polisi}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 8px 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a3a6e; padding-bottom: 16px; margin-bottom: 20px; }
  .logo-text { font-size: 18px; font-weight: 700; color: #1a3a6e; }
  .logo-sub { font-size: 11px; color: #666; margin-top: 2px; }
  .invoice-meta { text-align: right; }
  .invoice-meta .label { font-size: 10px; color: #888; }
  .invoice-meta .value { font-weight: 600; color: #1a3a6e; }
  .nopol-badge { background: #1a3a6e; color: #fff; display: inline-flex; align-items: center; padding: 6px 18px; border-radius: 6px; font-size: 22px; font-weight: 700; letter-spacing: 4px; margin-bottom: 12px; line-height: 1; }
  .kendaraan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 16px; }
  .kendaraan-grid .item { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #eee; }
  .kendaraan-grid .item .lbl { color: #888; }
  .kendaraan-grid .item .val { font-weight: 600; }
  section { margin-bottom: 18px; }
  section h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1a3a6e; letter-spacing: 1px; border-bottom: 1px solid #dde3f0; padding-bottom: 4px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #1a3a6e; color: #fff; }
  thead th { padding: 6px 8px; text-align: left; font-weight: 600; }
  thead th.right { text-align: right; }
  .summary-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #eee; }
  .summary-row .lbl { color: #555; }
  .summary-row .val { font-weight: 600; }
  .total-box { background: #1a3a6e; color: #fff; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
  .total-box .lbl { font-size: 11px; opacity: 0.8; }
  .total-box .val { font-size: 18px; font-weight: 700; }
  .notice { font-size: 10px; color: #888; text-align: center; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo-text">BAPENDA Provinsi Jambi</div>
    <div class="logo-sub">Badan Pendapatan Daerah Provinsi Jambi</div>
  </div>
  <div class="invoice-meta">
    <div class="label">Tanggal Cetak</div>
    <div class="value">${now}</div>
  </div>
</div>

<div class="nopol-badge">${kendaraan.no_polisi}</div>
<div class="kendaraan-grid">
  <div class="item"><span class="lbl">Merek / Model</span><span class="val">${kendaraan.nm_merek_kb} ${kendaraan.nm_model_kb}</span></div>
  <div class="item"><span class="lbl">Tahun</span><span class="val">${kendaraan.th_rakitan}</span></div>
  <div class="item"><span class="lbl">Jenis</span><span class="val">${kendaraan.nm_jenis_kb}</span></div>
  <div class="item"><span class="lbl">Warna</span><span class="val">${kendaraan.warna_kb}</span></div>
  <div class="item"><span class="lbl">CC / BBM</span><span class="val">${kendaraan.jumlah_cc} CC / ${kendaraan.bbm?.nama ?? "-"}</span></div>
  <div class="item"><span class="lbl">PKB s/d</span><span class="val">${formatDate(kendaraan.tg_akhir_pkb)}</span></div>
</div>

${pajak ? `
<section>
  <h3>Pajak Kendaraan Bermotor (PKB)</h3>
  <div class="summary-row"><span class="lbl">Terakhir Bayar</span><span class="val">${formatDate(pajak.terakhir_bayar)}</span></div>
  <div class="summary-row"><span class="lbl">PKB Pokok</span><span class="val">${pajak.tagihan.total.pkb.pokok}</span></div>
  <div class="summary-row"><span class="lbl">Denda PKB</span><span class="val" style="color:#dc2626">${pajak.tagihan.total.pkb.denda}</span></div>
  <div class="summary-row"><span class="lbl">Opsen Pokok</span><span class="val">${pajak.tagihan.total.opsen.pokok}</span></div>
  <div class="summary-row" style="margin-bottom:10px"><span class="lbl">Denda Opsen</span><span class="val" style="color:#dc2626">${pajak.tagihan.total.opsen.denda}</span></div>
  <table>
    <thead><tr>
      <th>Periode</th><th>Telat</th><th class="right">PKB Pokok</th><th class="right">Denda PKB</th><th class="right">Opsen</th><th class="right">Denda Opsen</th><th class="right">Total</th>
    </tr></thead>
    <tbody>${rincianPKBRows}</tbody>
  </table>
</section>` : ""}

${jr ? `
<section>
  <h3>Jasa Raharja</h3>
  <div class="summary-row"><span class="lbl">Pokok JR</span><span class="val">${formatRupiah(jr.total_tarif.pokok_jr + jr.total_tarif.kartu_jr)}</span></div>
  <div class="summary-row" style="margin-bottom:10px"><span class="lbl">Denda JR</span><span class="val" style="color:#dc2626">${formatRupiah(jr.total_tarif.denda_jr)}</span></div>
  <table>
    <thead><tr>
      <th>Keterangan</th><th class="right">Pokok</th><th class="right">Denda</th><th class="right">Subtotal</th>
    </tr></thead>
    <tbody>${rincianJRRows}</tbody>
  </table>
</section>` : ""}

${pnbp ? `
<section>
  <h3>PNBP</h3>
  <div class="summary-row"><span class="lbl">STNK</span><span class="val">${pnbp.pnbp.stnk?.status ? pnbp.pnbp.stnk.nominal : "Rp 0"}</span></div>
  <div class="summary-row"><span class="lbl">TNKB</span><span class="val">${pnbp.pnbp.tnkb?.status ? pnbp.pnbp.tnkb.nominal : "Rp 0"}</span></div>
</section>` : ""}

<div class="total-box">
  <span class="lbl">Total Yang Harus Dibayar</span>
  <span class="val">${formatRupiah(grandTotal)}</span>
</div>

<div class="notice">
  * Nominal bersifat estimasi. Nilai final mengacu pada ketetapan resmi di kantor Samsat saat pembayaran pajak.
</div>
</body>
</html>`;

  return html;
}

async function downloadInvoice(data: AllData, grandTotal: number) {
  const html = buildInvoiceHtml(data, grandTotal);
  const filename = `invoice-pkb-${data.kendaraan.no_polisi.replace(/\s/g, "-")}.pdf`;

  // Dynamic import agar tidak masuk bundle server-side
  const html2pdf = (await import("html2pdf.js")).default;

  const container = document.createElement("div");
  container.innerHTML = html;
  // Ambil hanya <body> content agar style inline ikut
  const body = container.querySelector("body");
  const el = body ?? container;

  html2pdf()
    .set({
      margin: [10, 12, 10, 12],
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(el)
    .save();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <p className="text-xs opacity-60 mb-1">{label}</p>
      <p className="font-bold text-base">{value}</p>
    </div>
  );
}

function TableSection({ title, headers, rows }: {
  title: string;
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              {headers.map((h, i) => (
                <th key={i} className={`px-3 py-2 font-semibold ${i > 1 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-gray-50">
                {row.map((cell, j) => (
                  <td key={j} className={`px-3 py-2 ${j > 1 ? "text-right" : ""} ${j === row.length - 1 ? "font-semibold" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CekPkbClient() {
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<AllData | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceHtml, setInvoiceHtml] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Input phone-style: format BH·1234·AB dengan spasi otomatis
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.toUpperCase().replace(/\s/g, "");
    // Pisahkan segmen: huruf plat (1-2) + angka (1-4) + huruf akhir (1-3)
    const m = raw.match(/^([A-Z]{1,2})?(\d{1,4})?([A-Z]{1,3})?/);
    if (!m) { setInputVal(raw); return; }
    const parts = [m[1], m[2], m[3]].filter(Boolean);
    setInputVal(parts.join(" "));
    setError("");
  }

  async function handleSearch() {
    const normalized = normalizeNopol(inputVal);
    if (normalized.replace(/\s/g, "").length < 3) {
      setError("Masukkan nomor polisi yang valid");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    let bundle: PkbBundle;
    try {
      bundle = await fetchPkbBundle(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil data");
      setLoading(false);
      return;
    }
    const { kendaraan, pajak, jr, pnbp } = bundle;

    setData({ kendaraan, pajak, jr, pnbp });
    setLoading(false);
  }

  const sudahBayar = data?.pajak ? isSudahBayar(data.pajak) : false;
  const tampilTagihan = data?.kendaraan ? shouldShowTagihan(data.kendaraan.tg_akhir_pkb) : false;

  const totalPajak = data?.pajak && !sudahBayar ? parseRupiah(data.pajak.tagihan.total.grand_total) : 0;
  const totalJR = data?.jr && !sudahBayar ? data.jr.total_tarif.total : 0;
  const totalPNBP = data?.pnbp && !sudahBayar ? parseRupiah(data.pnbp.pnbp.total) : 0;
  const grandTotal = totalPajak + totalJR + totalPNBP;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-900">Cek Pajak Kendaraan</h1>
          <p className="text-gray-500 text-sm mt-1">Cek tagihan PKB, Jasa Raharja, dan PNBP kendaraan terdaftar di Provinsi Jambi</p>

          {/* Search bar */}
          <div className="mt-6 flex gap-3 max-w-lg">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Contoh: 1234 AB atau BH 1234 AB"
                maxLength={12}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition uppercase placeholder:normal-case placeholder:tracking-normal placeholder:font-sans"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none font-sans tracking-normal" style={{ display: inputVal ? "none" : undefined }} />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              {loading
                ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                : <Search className="h-4 w-4" />}
              {loading ? "Mencari..." : "Cari"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Jika tidak diisi prefix plat, otomatis menggunakan <span className="font-semibold">BH</span> (Jambi)</p>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Notice */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
        <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Nominal bersifat estimasi. Nilai final mengacu pada ketetapan resmi di kantor Samsat saat pembayaran pajak.
          </p>
        </div>
      </div>

      {/* Results */}
      {data && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* ── Kolom kiri: info kendaraan (sticky) ── */}
            <div className="lg:sticky lg:top-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-primary px-5 py-5">
                  <p className="text-xs text-white/60 mb-1">Nomor Polisi</p>
                  <p className="text-3xl font-bold text-white tracking-widest">{data.kendaraan.no_polisi}</p>
                  <p className="text-sm text-white/70 mt-1.5">
                    {[data.kendaraan.nm_merek_kb, data.kendaraan.nm_model_kb].filter(Boolean).join(" ")}
                  </p>
                </div>
                <div className="px-5 py-4 space-y-2.5 text-sm">
                  {[
                    { label: "Tahun", value: data.kendaraan.th_rakitan },
                    { label: "Jenis", value: data.kendaraan.nm_jenis_kb },
                    { label: "Warna", value: data.kendaraan.warna_kb },
                    { label: "CC / BBM", value: `${data.kendaraan.jumlah_cc} CC / ${data.kendaraan.bbm?.nama ?? "-"}` },
                    { label: "NJKB", value: data.kendaraan.njkb?.nilai_jual ?? "-" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-gray-400 flex-shrink-0">{label}</span>
                      <span className="font-medium text-gray-800 text-right">{value || "-"}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2.5 space-y-2.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 flex-shrink-0">PKB s/d</span>
                      <span className="font-medium text-gray-800">{formatDate(data.kendaraan.tg_akhir_pkb)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 flex-shrink-0">STNK s/d</span>
                      <span className="font-medium text-gray-800">{formatDate(data.kendaraan.tg_akhir_stnk)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400 flex-shrink-0">Lokasi</span>
                      <span className="font-medium text-gray-800 text-right text-xs">{data.kendaraan.lokasi_transaksi_terakhir?.nama ?? "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Kolom kanan (2/3): detail tagihan ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Belum waktunya tagihan */}
              {!tampilTagihan && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Tagihan Belum Tersedia</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Jatuh tempo PKB: <span className="font-semibold text-gray-700">{formatDate(data.kendaraan.tg_akhir_pkb)}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Tagihan akan muncul 3 bulan sebelum jatuh tempo.</p>
                  </div>
                </div>
              )}

              {/* Sudah bayar */}
              {tampilTagihan && sudahBayar && data.pajak && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Pajak Sudah Dibayar</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Terakhir bayar: <span className="font-semibold text-gray-700">{formatDate(data.pajak.terakhir_bayar)}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Tidak ada tagihan aktif saat ini.</p>
                  </div>
                </div>
              )}

              {/* Ada tagihan */}
              {tampilTagihan && !sudahBayar && data.pajak && (
                <>
                  {/* Total card */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-red-100 mb-1">Total Yang Harus Dibayar</p>
                        <p className="text-3xl font-bold text-white">{formatRupiah(grandTotal)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setInvoiceHtml(buildInvoiceHtml(data, grandTotal));
                            setInvoiceOpen(true);
                          }}
                          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          Lihat
                        </button>
                        <button
                          onClick={() => downloadInvoice(data, grandTotal)}
                          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          Unduh
                        </button>
                      </div>
                    </div>
                    <div className="px-6 py-4 space-y-2">
                      <div className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50">
                        <span className="text-gray-500 flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Pajak (PKB)</span>
                        <span className="font-semibold text-red-600">{data.pajak.tagihan.total.grand_total}</span>
                      </div>
                      {data.jr && (
                        <div className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50">
                          <span className="text-gray-500 flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Jasa Raharja</span>
                          <span className="font-semibold text-green-600">{formatRupiah(data.jr.total_tarif.total)}</span>
                        </div>
                      )}
                      {data.pnbp && (
                        <div className="flex justify-between items-center text-sm py-1.5">
                          <span className="text-gray-500 flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> PNBP</span>
                          <span className="font-semibold text-blue-600">{data.pnbp.pnbp.total}</span>
                        </div>
                      )}
                      <div className="pt-2 flex gap-4 text-xs text-gray-400 border-t border-gray-50">
                        <span>Terakhir bayar: <span className="font-medium text-gray-600">{formatDate(data.pajak.terakhir_bayar)}</span></span>
                        <span>Tunggakan: <span className="font-medium text-red-500">{data.pajak.jarak.tahun} thn {data.pajak.jarak.bulan % 12} bln</span></span>
                      </div>
                    </div>
                  </div>

                  {/* PKB detail */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                    <h3 className="font-semibold text-gray-800">Rincian Pajak Kendaraan (PKB)</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard label="PKB Pokok" value={data.pajak.tagihan.total.pkb.pokok} color="bg-blue-50 text-blue-700" />
                      <StatCard label="Denda PKB" value={data.pajak.tagihan.total.pkb.denda} color="bg-red-50 text-red-700" />
                      <StatCard label="Opsen Pokok" value={data.pajak.tagihan.total.opsen.pokok} color="bg-indigo-50 text-indigo-700" />
                      <StatCard label="Denda Opsen" value={data.pajak.tagihan.total.opsen.denda} color="bg-orange-50 text-orange-700" />
                    </div>
                    <TableSection
                      title="Per Periode"
                      headers={["Periode", "Telat", "PKB Pokok", "Denda PKB", "Opsen", "Denda Opsen", "Total"]}
                      rows={data.pajak.tagihan.rincian.map((item) => [
                        item.periode.periode,
                        `${item.periode.total_bulan_telat} bln`,
                        item.pkb.pokok,
                        <span key="d" className="text-red-500">{item.pkb.denda}</span>,
                        item.is_opsen ? (item.opsen?.opsen ?? "-") : "-",
                        <span key="do" className="text-red-500">{item.opsen?.denda_opsen}</span>,
                        item.total,
                      ])}
                    />
                  </div>

                  {/* JR detail */}
                  {data.jr && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                      <h3 className="font-semibold text-gray-800">Rincian Jasa Raharja</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Pokok JR" value={formatRupiah(data.jr.total_tarif.pokok_jr + data.jr.total_tarif.kartu_jr)} color="bg-teal-50 text-teal-700" />
                        <StatCard label="Denda JR" value={formatRupiah(data.jr.total_tarif.denda_jr)} color="bg-red-50 text-red-700" />
                      </div>
                      <TableSection
                        title="Per Tahun"
                        headers={["Keterangan", "Pokok", "Denda", "Subtotal"]}
                        rows={data.jr.tarif_per_tahun.map((item) => [
                          item.keterangan,
                          formatRupiah(item.kartu_jr + item.pokok_jr),
                          <span key="d" className="text-red-500">{formatRupiah(item.denda_jr)}</span>,
                          formatRupiah(item.subtotal),
                        ])}
                      />
                    </div>
                  )}

                  {/* PNBP detail */}
                  {data.pnbp && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <h3 className="font-semibold text-gray-800 mb-4">PNBP</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard label="STNK" value={data.pnbp.pnbp.stnk?.status ? data.pnbp.pnbp.stnk.nominal : "Rp 0"} color="bg-green-50 text-green-700" />
                        <StatCard label="TNKB" value={data.pnbp.pnbp.tnkb?.status ? data.pnbp.pnbp.tnkb.nominal : "Rp 0"} color="bg-purple-50 text-purple-700" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal preview invoice */}
      <Dialog open={invoiceOpen} onOpenChange={(v) => { if (!v) setInvoiceOpen(false); }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Invoice PKB — {data?.kendaraan.no_polisi}
              </DialogTitle>
              <button
                onClick={() => data && downloadInvoice(data, grandTotal)}
                className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors border border-primary/20 mr-8"
              >
                <Download className="h-4 w-4" />
                Unduh
              </button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-4">
            <iframe
              srcDoc={invoiceHtml}
              className="w-full h-full rounded-xl border border-gray-100 bg-white"
              title="Preview Invoice PKB"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
