"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, MapPin, MapPinOff } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { uptdSchema, UptdInput } from "@/lib/validations";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { DataTableFilter } from "@/components/seloko/data-table-filter";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { ConfirmDialog } from "@/components/seloko/confirm-dialog";
import { useDebounce } from "@/hooks/use-debounce";

import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type Uptd = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  headName: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  subDistrict: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
  isActive: boolean;
  showOnPublicMap: boolean;
  createdAt: string;
  totalUser: number;
};

type UptdResponse = {
  data: Uptd[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  // Handles formats:
  // https://maps.google.com/?q=-1.6101,103.6131
  // https://www.google.com/maps/place/.../@-1.6101,103.6131,17z/...
  // https://goo.gl/maps/... (short URL — can't parse without redirect)
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,         // /@lat,lng
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,    // ?q=lat,lng
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,        // ll=lat,lng
  ];
  for (const pattern of patterns) {
    const m = url.match(pattern);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }
  return null;
}

function MapPreview({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  if (!lat || !lng) {
    return (
      <div className="mt-2 h-36 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground bg-muted/30">
        Isi koordinat untuk melihat preview lokasi
      </div>
    );
  }
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="mt-2 rounded-lg overflow-hidden border">
      <iframe
        src={src}
        width="100%"
        height="180"
        loading="lazy"
        title="Preview Lokasi"
        className="block"
      />
      <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/40 flex gap-4">
        <span>Lat: {lat}</span>
        <span>Lng: {lng}</span>
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-primary hover:underline"
        >
          Buka di peta ↗
        </a>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SelokoUptdPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [hasUsersFilter, setHasUsersFilter] = useState(searchParams.get("hasUsers") ?? "all");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("limit") ?? 10));

  const debouncedSearch = useDebounce(searchInput, 2000);
  const isSearching = searchInput !== debouncedSearch;

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ── URL sync ───────────────────────────────────────────────────────────────

  const pushParams = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(overrides).forEach(([k, v]) => {
        if (v && v !== "all") params.set(k, v);
        else params.delete(k);
      });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  useEffect(() => {
    pushParams({ search: debouncedSearch, page: "1" });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<UptdResponse>({
    queryKey: ["seloko-uptd", page, pageSize, debouncedSearch, statusFilter, hasUsersFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter === "active") params.set("isActive", "true");
      if (statusFilter === "inactive") params.set("isActive", "false");
      if (hasUsersFilter === "yes") params.set("hasUsers", "true");
      if (hasUsersFilter === "no") params.set("hasUsers", "false");
      return api.get(`/seloko/uptd?${params.toString()}`).then((r) => r.data);
    },
  });

  const uptds = data?.data ?? [];
  const meta = data?.meta;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<UptdInput>({
    resolver: zodResolver(uptdSchema),
    defaultValues: { isActive: true, showOnPublicMap: false, province: "Jambi" },
  });

  const watchedLat = watch("latitude");
  const watchedLng = watch("longitude");

  const saveMutation = useMutation({
    mutationFn: (payload: UptdInput) =>
      editId ? api.put(`/seloko/uptd/${editId}`, payload) : api.post("/seloko/uptd", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-uptd"] });
      toast.success(editId ? "UPTD diperbarui" : "UPTD berhasil dibuat");
      setFormOpen(false);
      reset();
      setEditId(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menyimpan UPTD"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/seloko/uptd/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-uptd"] });
      toast.success("UPTD dihapus");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menghapus UPTD"),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openCreate() {
    reset({
      isActive: true,
      showOnPublicMap: false,
      province: "Jambi",
    });
    setEditId(null);
    setFormOpen(true);
  }

  function openEdit(u: Uptd) {
    reset({
      code: u.code,
      name: u.name,
      description: u.description ?? undefined,
      address: u.address ?? undefined,
      phone: u.phone ?? undefined,
      email: u.email ?? undefined,
      headName: u.headName ?? undefined,
      province: u.province ?? "Jambi",
      city: u.city ?? undefined,
      district: u.district ?? undefined,
      subDistrict: u.subDistrict ?? undefined,
      postalCode: u.postalCode ?? undefined,
      latitude: u.latitude ?? undefined,
      longitude: u.longitude ?? undefined,
      googleMapsUrl: u.googleMapsUrl ?? undefined,
      isActive: u.isActive,
      showOnPublicMap: u.showOnPublicMap,
    });
    setEditId(u.id);
    setFormOpen(true);
  }

  function handleStatusFilter(val: string) {
    setStatusFilter(val);
    setPage(1);
    pushParams({ status: val, page: "1" });
  }

  function handleHasUsersFilter(val: string) {
    setHasUsersFilter(val);
    setPage(1);
    pushParams({ hasUsers: val, page: "1" });
  }

  function handlePageChange(p: number) {
    setPage(p);
    pushParams({ page: String(p) });
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size);
    setPage(1);
    pushParams({ limit: String(size), page: "1" });
  }

  function handleReset() {
    setSearchInput("");
    setStatusFilter("all");
    setHasUsersFilter("all");
    setPage(1);
    router.replace(pathname, { scroll: false });
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnDef<Uptd>[] = [
    {
      key: "code",
      header: "Kode",
      cellClassName: "font-mono text-sm",
      render: (u) => u.code,
    },
    {
      key: "name",
      header: "Nama UPTD",
      render: (u) => (
        <Link
          href={`/seloko/uptd/${u.id}`}
          className="font-medium text-primary hover:underline underline-offset-4 transition-colors"
        >
          {u.name}
        </Link>
      ),
    },
    {
      key: "address",
      header: "Alamat",
      cellClassName: "text-sm text-muted-foreground max-w-[200px] truncate",
      render: (u) => u.address ?? "-",
    },
    {
      key: "totalUser",
      header: "Total User",
      cellClassName: "text-sm text-center",
      headerClassName: "text-center",
      render: (u) => (
        <span className="inline-flex items-center justify-center min-w-[2rem] rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {u.totalUser}
        </span>
      ),
    },
    {
      key: "location",
      header: "Peta",
      headerClassName: "text-center",
      cellClassName: "text-center",
      render: (u) =>
        u.latitude && u.longitude ? (
          <span title="Koordinat tersedia" className="flex justify-center">
            <MapPin className="h-4 w-4 text-green-600" />
          </span>
        ) : (
          <span title="Koordinat belum diisi" className="flex justify-center">
            <MapPinOff className="h-4 w-4 text-muted-foreground" />
          </span>
        ),
    },
    {
      key: "showOnPublicMap",
      header: "Publik",
      headerClassName: "text-center",
      cellClassName: "text-center",
      render: (u) => (
        <Badge variant={u.showOnPublicMap ? "success" : "outline"} className="text-xs">
          {u.showOnPublicMap ? "Tampil" : "Disembunyikan"}
        </Badge>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (u) => (
        <Badge variant={u.isActive ? "success" : "outline"}>
          {u.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Dibuat",
      cellClassName: "text-sm text-muted-foreground whitespace-nowrap",
      render: (u) => formatDate(u.createdAt),
    },
    {
      key: "actions",
      header: "Aksi",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" title="Edit" onClick={() => openEdit(u)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="destructive" title="Hapus" onClick={() => setDeleteId(u.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-primary">Manajemen UPTD</h1>
          <p className="text-sm text-muted-foreground">Kelola Unit Pelaksana Teknis Daerah Samsat</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />Tambah UPTD
        </Button>
      </div>

      {/* Filter */}
      <DataTableFilter
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Cari nama atau kode UPTD..."
        isSearching={isSearching}
        onReset={handleReset}
        selects={[
          {
            value: statusFilter,
            onChange: handleStatusFilter,
            placeholder: "Status",
            allLabel: "Semua Status",
            options: [
              { label: "Aktif", value: "active" },
              { label: "Nonaktif", value: "inactive" },
            ],
          },
          {
            value: hasUsersFilter,
            onChange: handleHasUsersFilter,
            placeholder: "Memiliki User",
            allLabel: "Semua",
            options: [
              { label: "Memiliki User", value: "yes" },
              { label: "Tidak Memiliki User", value: "no" },
            ],
          },
        ]}
      />

      {/* Table */}
      <DataTable<Uptd>
        data={uptds}
        columns={columns}
        isLoading={isLoading || isSearching}
        emptyMessage="Belum ada UPTD"
        skeletonRows={pageSize}
      />

      {/* Pagination */}
      <DataTablePagination
        page={page}
        totalPages={meta?.totalPages ?? 1}
        totalItems={meta?.totalItems ?? 0}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Hapus UPTD"
        description="UPTD yang dihapus tidak dapat dikembalikan. Lanjutkan?"
        confirmLabel="Ya, Hapus"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId, { onSettled: () => setDeleteId(null) });
        }}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 max-h-[90vh] flex flex-col">
          <VisuallyHidden.Root>
            <DialogTitle>{editId ? "Edit UPTD" : "Tambah UPTD Baru"}</DialogTitle>
          </VisuallyHidden.Root>
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">{editId ? "Edit UPTD" : "Tambah UPTD Baru"}</h2>
          </div>

          <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Identitas */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identitas</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kode UPTD <span className="text-red-500">*</span></Label>
                    <Input placeholder="UPTD-001" {...register("code")} />
                    {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      {...register("isActive", { setValueAs: (v) => v === "true" || v === true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Aktif</SelectItem>
                        <SelectItem value="false">Nonaktif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <Label>Nama UPTD <span className="text-red-500">*</span></Label>
                  <Input placeholder="UPTD Samsat Kota Jambi" {...register("name")} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2 pt-2">
                  <Label>Nama Kepala</Label>
                  <Input placeholder="Dr. H. Ahmad, M.Si" {...register("headName")} />
                </div>
                <div className="space-y-2 pt-2">
                  <Label>Deskripsi</Label>
                  <Textarea placeholder="Deskripsi singkat UPTD..." rows={2} {...register("description")} />
                </div>
              </div>

              {/* Kontak */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kontak</p>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-2">
                    <Label>Telepon</Label>
                    <Input placeholder="0741-xxxxx" {...register("phone")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="uptd@bapenda.go.id" {...register("email")} />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                </div>
              </div>

              {/* Wilayah */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wilayah</p>
                <div className="space-y-2 pt-1">
                  <Label>Alamat</Label>
                  <Textarea placeholder="Alamat lengkap UPTD" rows={2} {...register("address")} />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>Provinsi</Label>
                    <Input placeholder="Jambi" {...register("province")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Kota / Kabupaten</Label>
                    <Input placeholder="Kota Jambi" {...register("city")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Kecamatan</Label>
                    <Input placeholder="Pasar Jambi" {...register("district")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Kelurahan</Label>
                    <Input placeholder="Kelurahan" {...register("subDistrict")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Kode Pos</Label>
                    <Input placeholder="36111" {...register("postalCode")} />
                  </div>
                </div>
              </div>

              {/* Lokasi */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lokasi & Peta</p>

                {/* Opsi A: Parse dari Google Maps URL */}
                <div className="space-y-2 pt-1">
                  <Label>Link Google Maps</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Tempel link Google Maps di sini..."
                      {...register("googleMapsUrl")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        const url = (watch("googleMapsUrl") ?? "");
                        const coords = parseGoogleMapsUrl(url);
                        if (coords) {
                          setValue("latitude", coords.lat);
                          setValue("longitude", coords.lng);
                          toast.success("Koordinat berhasil diambil dari link Google Maps");
                        } else {
                          toast.error("Format link tidak dikenali. Coba salin koordinat manual.");
                        }
                      }}
                    >
                      Ambil Koordinat
                    </Button>
                  </div>
                  {errors.googleMapsUrl && <p className="text-xs text-destructive">{errors.googleMapsUrl.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    Salin link dari Google Maps → Bagikan → Salin tautan, lalu klik &quot;Ambil Koordinat&quot;.
                  </p>
                </div>

                {/* Opsi C: Manual input */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="-1.6101"
                      {...register("latitude", { valueAsNumber: true })}
                    />
                    {errors.latitude && <p className="text-xs text-destructive">{errors.latitude.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="103.6131"
                      {...register("longitude", { valueAsNumber: true })}
                    />
                    {errors.longitude && <p className="text-xs text-destructive">{errors.longitude.message}</p>}
                  </div>
                </div>

                {/* Map preview iframe */}
                <MapPreview lat={watchedLat} lng={watchedLng} />

                {/* Show on public map toggle */}
                <div className="flex items-center gap-3 pt-2">
                  <input
                    id="showOnPublicMap"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    {...register("showOnPublicMap")}
                  />
                  <Label htmlFor="showOnPublicMap" className="cursor-pointer">
                    Tampilkan pada peta publik website
                  </Label>
                </div>
              </div>
            </div>

            {/* <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
              <Button type="submit" loading={isSubmitting || saveMutation.isPending}>Simpan</Button>
            </DialogFooter> */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
              <Button type="submit" loading={isSubmitting || saveMutation.isPending}>Simpan</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Page() {
  return <Suspense><SelokoUptdPage /></Suspense>;
}
