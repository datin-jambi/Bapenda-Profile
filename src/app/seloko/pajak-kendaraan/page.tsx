"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, Suspense } from "react";
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
import { MapPin, Car, CheckCircle2, XCircle, Loader2, SearchCheck, Save, Calendar, Fuel, Gauge, Palette, CreditCard } from "lucide-react";
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
    onSuccess: (result: CheckResult) => setCheckResult(result),
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
      if (sync && !sync.success && !sync.skipped) {
        // Log tetap tersimpan; yang gagal hanya pengiriman ke Samsat.
        toast.warning(`Log tersimpan, namun gagal dikirim ke Samsat: ${sync.message}`, {
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Cek Pajak Kendaraan</h1>
        <p className="text-sm text-muted-foreground">
          Masukkan nomor polisi atau scan via kamera untuk mengecek status pajak kendaraan
        </p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Form Card */}
          {/* Input Nopol */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4" />
                Form Pengecekan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lokasi & catatan diisi lebih dulu, sengaja tidak ikut ter-reset
                  saat cek/simpan agar bisa dipakai ulang lintas kendaraan. */}
              <div className="space-y-2">
                <Label>Lokasi</Label>
                <Input
                  placeholder="contoh: Jl. Merdeka, Kota Jambi"
                  value={lokasi}
                  onChange={(e) => setLokasi(e.target.value)}
                  className="text-base md:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Catatan</Label>
                <Textarea
                  placeholder="Catatan tambahan (opsional)"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-base md:text-sm"
                />
              </div>

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
                    className="font-mono tracking-wide text-base md:text-sm"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="search"
                  />
                  {!checkResult ? (
                    <>
                      <CameraScanner onDetected={handleCameraDetected} />
                      <Button
                        type="button"
                        size="icon"
                        onClick={handleCheck}
                        disabled={checkMutation.isPending || !nopolInput.trim()}
                        className="h-11 w-11 shrink-0 md:h-9 md:w-9"
                        aria-label="Cek nomor polisi"
                        title="Cek nomor polisi"
                      >
                        {checkMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SearchCheck className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      className="h-11 shrink-0 md:h-9"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Geolocation Status */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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

              {/* Camera Tips */}
              {!checkResult && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                  <p className="font-medium">Tips scan plat nomor:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Klik ikon kamera untuk scan otomatis</li>
                    <li>Pastikan plat nomor terlihat jelas</li>
                    <li>Hindari silau atau bayangan</li>
                  </ul>
                </div>
              )}

              {/* Kondisi kendaraan — hanya muncul setelah data kendaraan ditemukan,
                  karena baru bisa dinilai setelah petugas melihat hasil pengecekan.
                  Wajib dipilih sebelum log boleh disimpan. */}
              {checkResult && (
                <div className="space-y-2">
                  <Label>
                    Kondisi <span className="text-red-500">*</span>
                  </Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger className="w-full h-11 md:h-9">
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
                    <p className="text-xs text-muted-foreground">
                      Wajib dipilih sebelum menyimpan log.
                    </p>
                  )}
                </div>
              )}

              {/* Save Button */}
              <Button
                type="button"
                className="w-full h-11 md:h-10"
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
              {!checkResult && (
                <p className="text-xs text-muted-foreground">
                  Cek nomor polisi dulu — lokasi & catatan di atas akan ikut tersimpan,
                  kondisi kendaraan dipilih setelah datanya ditemukan.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Hasil Pengecekan */}
          {checkResult && (
            <>
              {/* Status Badge */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    {checkResult.status === "Lunas" ? (
                      <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                        <XCircle className="h-6 w-6 text-red-600" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Status Pajak</p>
                      <p className="text-xl font-bold">
                        {checkResult.status === "Lunas" ? "LUNAS" : "BELUM LUNAS"}
                      </p>
                    </div>
                  </div>

                  {/* Tagihan info */}
                  {checkResult.tagihan && checkResult.status === "Belum Lunas" && (
                    <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-sm font-medium text-red-800">Total Tagihan</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatRupiah(checkResult.tagihan.grandTotal)}
                      </p>
                      {checkResult.tagihan.tahunTelat !== undefined && (
                        <p className="text-xs text-red-600 mt-1">
                          Telat {checkResult.tagihan.tahunTelat} tahun{" "}
                          {checkResult.tagihan.bulanTelat} bulan
                        </p>
                      )}
                    </div>
                  )}

                  {checkResult.status === "Lunas" && checkResult.tagihan?.jatuhTempo && (
                    <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-100">
                      <p className="text-sm text-green-700">
                        {checkResult.tagihan.terakhirBayar
                          ? `Terakhir bayar: ${formatDate(checkResult.tagihan.terakhirBayar)}`
                          : `Jatuh tempo: ${formatDate(checkResult.tagihan.jatuhTempo)}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Info Kendaraan */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Data Kendaraan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow
                    icon={<Car className="h-4 w-4" />}
                    label="No. Polisi"
                    value={checkResult.licensePlate}
                    bold
                  />
                  <InfoRow
                    icon={<Car className="h-4 w-4" />}
                    label="Merek"
                    value={`${checkResult.kendaraan.merek} ${checkResult.kendaraan.model}`}
                  />
                  <InfoRow
                    icon={<Palette className="h-4 w-4" />}
                    label="Jenis"
                    value={checkResult.kendaraan.jenis}
                  />
                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Tahun"
                    value={checkResult.kendaraan.tahun}
                  />
                  <InfoRow
                    icon={<Palette className="h-4 w-4" />}
                    label="Warna"
                    value={checkResult.kendaraan.warna}
                  />
                  <InfoRow
                    icon={<Gauge className="h-4 w-4" />}
                    label="CC"
                    value={String(checkResult.kendaraan.cc)}
                  />
                  {checkResult.kendaraan.bbm && (
                    <InfoRow
                      icon={<Fuel className="h-4 w-4" />}
                      label="BBM"
                      value={checkResult.kendaraan.bbm}
                    />
                  )}
                  {checkResult.kendaraan.njkb && (
                    <InfoRow
                      icon={<CreditCard className="h-4 w-4" />}
                      label="NJKB"
                      value={formatRupiah(checkResult.kendaraan.njkb)}
                    />
                  )}
                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="PKB Berlaku"
                    value={formatDate(checkResult.kendaraan.tgAkhirPkb)}
                  />
                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="STNK Berlaku"
                    value={formatDate(checkResult.kendaraan.tgAkhirStnk)}
                  />
                </CardContent>
              </Card>
            </>
          )}
      </div>
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
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        {icon}
        {label}
      </div>
      <span className={`text-right break-words min-w-0 ${bold ? "font-bold font-mono" : ""}`}>
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
