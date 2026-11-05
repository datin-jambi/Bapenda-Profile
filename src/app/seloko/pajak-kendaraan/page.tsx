"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, Suspense } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  vehicleTaxCheckSchema,
  VehicleTaxCheckInput,
} from "@/lib/validations";
import { toast } from "sonner";
import {
  MapPin,
  Search,
  Car,
  CheckCircle2,
  XCircle,
  Loader2,
  SearchCheck,
  Save,
  Calendar,
  Fuel,
  Gauge,
  Palette,
  CreditCard,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { CameraScanner } from "@/components/seloko/camera-scanner";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { useDebounce } from "@/hooks/use-debounce";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckLog = {
  id: number;
  licensePlate: string;
  status: string;
  condition: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  lokasi: string | null;
  createdAt: string;
  user: { id: number; name: string };
};

type CheckLogResponse = {
  data: CheckLog[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

type KendaraanInfo = {
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

type TagihanInfo = {
  terakhirBayar?: string;
  jatuhTempo?: string;
  grandTotal?: string;
  tahunTelat?: number;
  bulanTelat?: number;
} | null;

type CheckResult = {
  licensePlate: string;
  status: "Lunas" | "Belum Lunas";
  kendaraan: KendaraanInfo;
  tagihan: TagihanInfo;
  checkedAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(str?: string | null): string {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 2000);
  const isSearching = searchInput !== debouncedSearch;

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

  // ── Data fetching (riwayat) ──────────────────────────────────────────────

  const { data, isLoading } = useQuery<CheckLogResponse>({
    queryKey: ["cek-pajak", page, pageSize, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      return api.get(`/seloko/pajak-kendaraan?${params.toString()}`).then((r) => r.data);
    },
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  // ── Check mutation ────────────────────────────────────────────────────────

  const checkMutation = useMutation({
    mutationFn: (licensePlate: string) =>
      api
        .post("/seloko/pajak-kendaraan", { action: "check", licensePlate })
        .then((r) => r.data.data),
    // Lokasi & catatan sengaja tidak direset: petugas mengisinya sekali lalu
    // memakai nilai yang sama untuk beberapa kendaraan di lokasi tersebut.
    onSuccess: (result: CheckResult) => setCheckResult(result),
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal melakukan pengecekan"),
  });

  // ── Save mutation ─────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (payload: VehicleTaxCheckInput) =>
      api.post("/seloko/pajak-kendaraan", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cek-pajak"] });
      toast.success("Log pengecekan berhasil disimpan");
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
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: ColumnDef<CheckLog>[] = [
    {
      key: "licensePlate",
      header: "No. Polisi",
      cellClassName: "font-mono font-bold",
      render: (log) => log.licensePlate.toUpperCase(),
    },
    {
      key: "status",
      header: "Status",
      render: (log) => (
        <Badge variant={log.status === "Lunas" ? "success" : "destructive"}>
          {log.status === "Lunas" ? (
            <CheckCircle2 className="mr-1 h-3 w-3" />
          ) : (
            <XCircle className="mr-1 h-3 w-3" />
          )}
          {log.status}
        </Badge>
      ),
    },
    {
      key: "condition",
      header: "Kondisi",
      render: (log) => log.condition ?? "-",
    },
    {
      key: "lokasi",
      header: "Lokasi",
      render: (log) => log.lokasi ?? "-",
    },
    {
      key: "notes",
      header: "Catatan",
      render: (log) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {log.notes ?? "-"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Waktu",
      cellClassName: "text-sm text-muted-foreground whitespace-nowrap",
      render: (log) => formatDateTime(log.createdAt),
    },
  ];

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <div className="lg:col-span-1 space-y-4">
          {/* Input Nopol */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4" />
                Form Pengecekan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lokasi, kondisi & catatan diisi lebih dulu, sengaja tidak ikut
                  ter-reset saat cek/simpan agar bisa dipakai lintas kendaraan
                  (kondisi tetap direset tiap simpan karena melekat ke kendaraan). */}
              <div className="space-y-2">
                <Label>Lokasi</Label>
                <Input
                  placeholder="contoh: Jl. Merdeka, Kota Jambi"
                  value={lokasi}
                  onChange={(e) => setLokasi(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Catatan</Label>
                <Textarea
                  placeholder="Catatan tambahan (opsional)"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Kondisi</Label>
                <Input
                  placeholder="contoh: Baik, body lecet"
                  maxLength={100}
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
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
                  />
                  {!checkResult ? (
                    <>
                      <CameraScanner onDetected={handleCameraDetected} />
                      <Button
                        type="button"
                        onClick={handleCheck}
                        disabled={checkMutation.isPending || !nopolInput.trim()}
                      >
                        {checkMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SearchCheck className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" variant="outline" onClick={handleReset}>
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

              {/* Save Button */}
              <Button
                type="button"
                className="w-full"
                onClick={handleSave}
                disabled={!checkResult || saveMutation.isPending}
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
                  Cek nomor polisi dulu, lokasi, kondisi & catatan di atas akan ikut tersimpan.
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

        {/* History Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Pengecekan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nomor polisi..."
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              {/* Table */}
              <DataTable<CheckLog>
                data={logs}
                columns={columns}
                isLoading={isLoading || isSearching}
                emptyMessage="Belum ada data pengecekan"
                skeletonRows={pageSize}
                mobileCard={(log) => (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold">{log.licensePlate.toUpperCase()}</span>
                      <Badge variant={log.status === "Lunas" ? "success" : "destructive"}>
                        {log.status === "Lunas" ? (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        ) : (
                          <XCircle className="mr-1 h-3 w-3" />
                        )}
                        {log.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      {log.lokasi ?? "-"}
                    </p>
                    {log.condition && (
                      <p className="text-xs text-muted-foreground">Kondisi: {log.condition}</p>
                    )}
                    {log.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{log.notes}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                  </div>
                )}
              />

              {/* Pagination */}
              <DataTablePagination
                page={page}
                totalPages={meta?.totalPages ?? 1}
                totalItems={meta?.totalItems ?? 0}
                pageSize={pageSize}
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            </CardContent>
          </Card>
        </div>
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
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className={bold ? "font-bold font-mono" : ""}>{value}</span>
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
