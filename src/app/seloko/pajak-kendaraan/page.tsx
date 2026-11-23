"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, Suspense } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleTaxCheckInput } from "@/lib/validations";
import { checkPajakClient, type CheckResult } from "@/lib/pkb-client";
import { toast } from "sonner";
import { MapPin, Car, CheckCircle2, XCircle, Loader2, SearchCheck, Save, Calendar, Fuel, Gauge, Palette, CreditCard, X } from "lucide-react";
import { CameraScanner } from "@/components/seloko/camera-scanner";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Status pengiriman kondisi ke API Samsat (proses kedua setelah simpan log). */
type ConditionSync = {
  skipped?: boolean;
  success: boolean;
  message: string;
  httpStatus?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pilihan kondisi kendaraan yang disimpan di kolom `condition`. */
const CONDITION_OPTIONS = [
  "Baik",
  "Rusak",
  "Rusak berat",
  "Tidak sesuai kondisi",
  "Lainnya",
] as const;

function formatDate(str?: string | null): string {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRupiah(val?: string): string {
  if (!val || val === "0" || val === "-") return "Rp 0";
  const num = Number(String(val).replace(/[^0-9]/g, ""));
  return "Rp " + num.toLocaleString("id-ID");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CekPajakPage() {
  const queryClient = useQueryClient();
  // Hasil cek muncul di bawah form; di HP langsung digulir ke sana.
  const resultRef = useRef<HTMLDivElement>(null);

  // Check flow state
  const [nopolInput, setNopolInput] = useState("");
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  // Geolocation state
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Save form state
  const [lokasi, setLokasi] = useState("");
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");

  // ── Geolocation ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!navigator.geolocation) return;

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        setGeoError("Gagal mendapatkan lokasi");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Check mutation ────────────────────────────────────────────────────────

  const checkMutation = useMutation({
    // Pengecekan dilakukan di browser (lib/pkb-client), sama seperti halaman lain.
    mutationFn: (licensePlate: string) => checkPajakClient(licensePlate),
    // Lokasi & catatan sengaja tidak direset: petugas mengisinya sekali lalu
    // memakai nilai yang sama untuk beberapa kendaraan di lokasi tersebut.
    onSuccess: (result: CheckResult) => {
      setCheckResult(result);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal melakukan pengecekan"),
  });

  // ── Save mutation ─────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (payload: VehicleTaxCheckInput) =>
      api.post("/seloko/pajak-kendaraan", payload).then((r) => r.data as { data?: { conditionSync?: ConditionSync } }),
    onSuccess: (res) => {
      // Riwayat ada di halaman lain; buang cache-nya supaya langsung terbaru.
      queryClient.invalidateQueries({ queryKey: ["cek-pajak"] });
      const sync = res?.data?.conditionSync;
      if (sync && !sync.success) {
        // Log tetap tersimpan; yang gagal/di-skip hanya pengiriman ke Samsat.
        const alasan = sync.skipped ? "dilewati" : "gagal dikirim";
        toast.warning(`Log tersimpan, namun ${alasan} ke Samsat: ${sync.message}`, {
          duration: 8000,
        });
      } else {
        toast.success("Log pengecekan berhasil disimpan");
      }
      setCheckResult(null);
      setNopolInput("");
      // Kondisi melekat pada kendaraan yang baru dicek, jadi ikut direset —
      // berbeda dengan lokasi & catatan yang dipakai ulang lintas kendaraan.
      setCondition("");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menyimpan data"),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCheck() {
    if (!nopolInput.trim()) {
      toast.error("Masukkan nomor polisi terlebih dahulu");
      return;
    }
    checkMutation.mutate(nopolInput.trim());
  }

  function handleCameraDetected(licensePlate: string) {
    setNopolInput(licensePlate);
    // Auto-check after camera detection
    checkMutation.mutate(licensePlate);
  }

  function handleSave() {
    if (!checkResult) return;
    if (!condition.trim()) {
      toast.error("Pilih kondisi kendaraan terlebih dahulu");
      return;
    }

    saveMutation.mutate({
      licensePlate: checkResult.licensePlate,
      status: checkResult.status,
      condition: condition.trim() || null,
      notes: notes || null,
      latitude,
      longitude,
      lokasi: lokasi || null,
    });
  }

  function handleReset() {
    setCheckResult(null);
    setNopolInput("");
    // Kondisi milik kendaraan yang barusan dicek — jangan terbawa ke kendaraan berikutnya.
    setCondition("");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl">
      {/* Header — di HP judul sudah ada di top bar, jadi disembunyikan. */}
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold text-primary">Cek Pajak Kendaraan</h1>
        <p className="text-sm text-muted-foreground">
          Masukkan nomor polisi atau scan plat dengan kamera
        </p>
      </div>

      {/* Form Card */}
      <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
        <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-seloko-mist flex items-center justify-center">
              <Car className="h-4 w-4 text-seloko-blue" />
            </span>
            Form Pengecekan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0 space-y-4">
          {/* Nopol — elemen utama di HP, dibuat paling besar. */}
          <div className="space-y-2">
            <Label>
              No. Polisi <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="contoh: BH 1234 XX"
                value={nopolInput}
                onChange={(e) => setNopolInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCheck();
                  }
                }}
                disabled={!!checkResult}
                className="font-mono font-semibold tracking-wider h-12 text-lg rounded-xl bg-seloko-mist md:h-9 md:text-sm"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
              />
              {!checkResult ? (
                <>
                  {nopolInput && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setNopolInput("")}
                      aria-label="Hapus nomor polisi"
                      className="h-12 w-10 shrink-0 md:h-9 md:w-9"
                    >
                      <X className="h-5 w-5 md:h-4 md:w-4" />
                    </Button>
                  )}
                  <CameraScanner onDetected={handleCameraDetected} />
                  <Button
                    type="button"
                    size="icon"
                    onClick={handleCheck}
                    disabled={checkMutation.isPending || !nopolInput.trim()}
                    className="h-12 w-12 shrink-0 rounded-xl md:h-9 md:w-9"
                    aria-label="Cek nomor polisi"
                    title="Cek nomor polisi"
                  >
                    {checkMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin md:h-4 md:w-4" />
                    ) : (
                      <SearchCheck className="h-5 w-5 md:h-4 md:w-4" />
                    )}
                  </Button>
                </>
              ) : (
                <Button type="button" variant="outline" onClick={handleReset} className="h-12 shrink-0 rounded-xl md:h-9">
                  Reset
                </Button>
              )}
            </div>
            {/* Status GPS — satu baris kecil saja */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {geoLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Mendapatkan lokasi...
                </>
              ) : geoError ? (
                <>
                  <MapPin className="h-3 w-3 text-yellow-500" />
                  {geoError}
                </>
              ) : (
                <>
                  <MapPin className="h-3 w-3 text-green-500" />
                  Lokasi GPS aktif
                </>
              )}
            </div>
          </div>

          {/* Lokasi & catatan — diisi sekali, dipakai ulang lintas kendaraan. */}
          <div className="space-y-2">
            <Label>Lokasi</Label>
            <Input
              placeholder="contoh: Jl. Merdeka, Kota Jambi"
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              className="h-12 text-base rounded-xl md:h-9 md:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea
              placeholder="Catatan tambahan (opsional)"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-base rounded-xl md:text-sm"
            />
          </div>

          {/* Tips hanya untuk desktop; di HP ruangnya dipakai form. */}
          {!checkResult && (
            <div className="hidden md:block text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
              <p className="font-medium">Tips scan plat nomor:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Klik ikon kamera untuk scan otomatis</li>
                <li>Pastikan plat nomor terlihat jelas</li>
                <li>Hindari silau atau bayangan</li>
              </ul>
            </div>
          )}

          {/* Kondisi kendaraan — hanya muncul setelah data kendaraan ditemukan. */}
          {checkResult && (
            <div className="space-y-2">
              <Label>
                Kondisi <span className="text-red-500">*</span>
              </Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="w-full h-12 text-base rounded-xl md:h-9 md:text-sm">
                  <SelectValue placeholder="Pilih kondisi kendaraan" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!condition && (
                <p className="text-xs text-muted-foreground">Wajib dipilih sebelum menyimpan log.</p>
              )}
            </div>
          )}

          {!checkResult && (
            <p className="text-xs text-muted-foreground">
              Cek nomor polisi dulu — lokasi & catatan di atas akan ikut tersimpan,
              kondisi kendaraan dipilih setelah datanya ditemukan.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Simpan — di HP menempel di atas bottom tab bar supaya selalu terjangkau. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 px-4 py-3 bg-seloko-mist/95 backdrop-blur border-t md:static md:mx-0 md:p-0 md:border-0 md:bg-transparent">
        <Button
          type="button"
          className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-seloko-blue to-seloko-cyan hover:from-indigo-600 hover:to-seloko-navy border-0 text-white shadow-md shadow-seloko-blue/25 md:h-10 md:text-sm"
          onClick={handleSave}
          disabled={!checkResult || !condition || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Simpan Log
            </>
          )}
        </Button>
      </div>

      {/* Hasil Pengecekan */}
      {checkResult && (
        <>
          <div ref={resultRef} className="scroll-mt-20" />
          <Card className={`rounded-2xl border-0 shadow-md ${checkResult.status === "Lunas" ? "bg-gradient-to-br from-seloko-success to-seloko-cyan text-white shadow-seloko-success/25" : "bg-gradient-to-br from-seloko-danger to-seloko-warn text-white shadow-seloko-danger/25"}`}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full bg-white/25 flex items-center justify-center">
                  {checkResult.status === "Lunas" ? (
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  ) : (
                    <XCircle className="h-7 w-7 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-white/80">Status Pajak</p>
                  <p className="text-xl font-extrabold tracking-wide">
                    {checkResult.status === "Lunas" ? "LUNAS" : "BELUM LUNAS"}
                  </p>
                </div>
              </div>

              {checkResult.tagihan && checkResult.status === "Belum Lunas" && (
                <div className="p-3 rounded-xl bg-white/20">
                  <p className="text-xs text-white/80">Total Tagihan</p>
                  <p className="text-2xl font-extrabold">{formatRupiah(checkResult.tagihan.grandTotal)}</p>
                  {checkResult.tagihan.tahunTelat !== undefined && (
                    <p className="text-xs text-white/90 mt-0.5">
                      Telat {checkResult.tagihan.tahunTelat} tahun {checkResult.tagihan.bulanTelat} bulan
                    </p>
                  )}
                </div>
              )}

              {checkResult.status === "Lunas" && checkResult.tagihan?.jatuhTempo && (
                <div className="p-3 rounded-xl bg-white/20">
                  <p className="text-xs text-white/90">
                    {checkResult.tagihan.terakhirBayar
                      ? `Terakhir bayar: ${formatDate(checkResult.tagihan.terakhirBayar)}`
                      : `Jatuh tempo: ${formatDate(checkResult.tagihan.jatuhTempo)}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
            <CardHeader className="p-4 pb-2 md:p-6 md:pb-3">
              <CardTitle className="text-base">Data Kendaraan</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
              <div className="grid grid-cols-2 gap-2 md:block md:space-y-3">
                <InfoRow icon={<Car className="h-4 w-4" />} label="No. Polisi" value={checkResult.licensePlate} bold />
                <InfoRow icon={<Car className="h-4 w-4" />} label="Merek" value={`${checkResult.kendaraan.merek} ${checkResult.kendaraan.model}`} />
                <InfoRow icon={<Palette className="h-4 w-4" />} label="Jenis" value={checkResult.kendaraan.jenis} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Tahun" value={checkResult.kendaraan.tahun} />
                <InfoRow icon={<Palette className="h-4 w-4" />} label="Warna" value={checkResult.kendaraan.warna} />
                <InfoRow icon={<Gauge className="h-4 w-4" />} label="CC" value={String(checkResult.kendaraan.cc)} />
                {checkResult.kendaraan.bbm && (
                  <InfoRow icon={<Fuel className="h-4 w-4" />} label="BBM" value={checkResult.kendaraan.bbm} />
                )}
                {checkResult.kendaraan.njkb && (
                  <InfoRow icon={<CreditCard className="h-4 w-4" />} label="NJKB" value={formatRupiah(checkResult.kendaraan.njkb)} />
                )}
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="PKB Berlaku" value={formatDate(checkResult.kendaraan.tgAkhirPkb)} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="STNK Berlaku" value={formatDate(checkResult.kendaraan.tgAkhirStnk)} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Sub Components ───────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  bold,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0 rounded-xl bg-seloko-mist p-3 text-sm md:flex-row md:items-center md:justify-between md:gap-3 md:bg-transparent md:p-0">
      <div className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground shrink-0">
        {icon}
        {label}
      </div>
      <span className={`break-words min-w-0 md:text-right ${bold ? "font-bold font-mono" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <CekPajakPage />
    </Suspense>
  );
}
