"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import Image from "next/image";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { ConfirmDialog } from "@/components/seloko/confirm-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bannerSchema, BannerInput } from "@/lib/validations";
import { ImageUpload } from "@/components/seloko/image-upload";
import { Textarea } from "@/components/ui/textarea";
import { DataTableFilter } from "@/components/seloko/data-table-filter";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { useDebounce } from "@/hooks/use-debounce";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Banner = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  sortOrder: number;
  isActive: boolean;
};

type BannerResponse = {
  data: Banner[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

function SelokoBannersPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialise state from URL params
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("limit") ?? 10));

  // Debounced search — fires API after 2 s of inactivity
  const debouncedSearch = useDebounce(searchInput, 2000);
  const isSearching = searchInput !== debouncedSearch;

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleDialogOpenChange(v: boolean) {
    setOpen(v);
    if (!v) { reset(); setEditId(null); }
  }

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

  // Sync debounced search → URL + reset page
  useEffect(() => {
    pushParams({ search: debouncedSearch, page: "1" });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<BannerResponse>({
    queryKey: ["seloko-banners", page, pageSize, debouncedSearch, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter === "active") params.set("active", "true");
      if (statusFilter === "inactive") params.set("active", "false");
      return api.get(`/seloko/banners?${params.toString()}`).then((r) => r.data);
    },
  });

  const banners = data?.data ?? [];
  const meta = data?.meta;

  // ── Forms ──────────────────────────────────────────────────────────────────

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<BannerInput>({
    resolver: zodResolver(bannerSchema),
    defaultValues: { isActive: true, sortOrder: 0 },
  });

  const imageUrl = watch("imageUrl");

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (data: BannerInput) =>
      editId ? api.put(`/seloko/banners/${editId}`, data) : api.post("/seloko/banners", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-banners"] });
      toast.success(editId ? "Banner diperbarui" : "Banner dibuat");
      handleDialogOpenChange(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/seloko/banners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-banners"] });
      toast.success("Banner dihapus");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal"),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleStatusFilter(val: string) {
    setStatusFilter(val);
    setPage(1);
    pushParams({ status: val, page: "1" });
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
    setPage(1);
    router.replace(pathname, { scroll: false });
  }

  function openCreate() {
    reset({ isActive: true, sortOrder: 0, imageUrl: "" });
    setEditId(null);
    setOpen(true);
  }

  function openEdit(b: Banner) {
    reset({
      title: b.title,
      description: b.description,
      imageUrl: b.imageUrl,
      buttonText: b.buttonText,
      buttonUrl: b.buttonUrl,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
    });
    setEditId(b.id);
    setOpen(true);
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnDef<Banner>[] = [
    { key: "sortOrder", header: "Urutan", render: (b) => b.sortOrder },
    { key: "title", header: "Judul", cellClassName: "font-medium", render: (b) => b.title },
    {
      key: "imageUrl", header: "Gambar", render: (b) =>
        b.imageUrl ? (
          <div className="w-[100px] h-[60px] rounded overflow-hidden bg-gray-100 flex-shrink-0 relative">
            <Image
              src={b.imageUrl}
              alt={b.title}
              width={100}
              height={60}
              unoptimized
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                img.style.display = "none";
                const parent = img.parentElement;
                if (parent && !parent.querySelector("[data-fallback]")) {
                  const fb = document.createElement("div");
                  fb.dataset.fallback = "1";
                  fb.className = "absolute inset-0 flex items-center justify-center text-xs text-muted-foreground bg-gray-100";
                  fb.textContent = "Gagal muat";
                  parent.appendChild(fb);
                }
              }}
            />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Tidak ada gambar</span>
        ),
    },
    { key: "buttonText", header: "Tombol", cellClassName: "text-sm text-muted-foreground", render: (b) => b.buttonText || "-" },
    {
      key: "isActive", header: "Status", render: (b) =>
        <Badge variant={b.isActive ? "success" : "outline"}>{b.isActive ? "Aktif" : "Nonaktif"}</Badge>,
    },
    {
      key: "actions", header: "Aksi", headerClassName: "text-right", cellClassName: "text-right",
      render: (b) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" onClick={() => openEdit(b)}><Pencil className="h-3 w-3" /></Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteId(b.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-primary">Manajemen Banner</h1>
          <p className="text-sm text-muted-foreground">Kelola banner hero di halaman utama</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Tambah Banner</Button>
      </div>

      <DataTableFilter
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Cari judul..."
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
        ]}
      />

      <DataTable
        data={banners}
        columns={columns}
        isLoading={isLoading || isSearching}
        emptyMessage="Belum ada banner"
      />

      <DataTablePagination
        page={page}
        totalPages={meta?.totalPages ?? 1}
        totalItems={meta?.totalItems ?? 0}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Hapus Banner"
        description="Banner yang dihapus tidak dapat dikembalikan. Lanjutkan?"
        confirmLabel="Ya, Hapus"
        loading={deleteMutation.isPending}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId, { onSettled: () => setDeleteId(null) }); }}
      />

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl p-0 gap-0 max-h-[90vh] flex flex-col">
          <VisuallyHidden.Root>
            <DialogTitle>{editId ? "Edit Banner" : "Tambah Banner Baru"}</DialogTitle>
          </VisuallyHidden.Root>
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">{editId ? "Edit Banner" : "Tambah Banner Baru"}</h2>
          </div>

          <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="space-y-2">
                <Label>Judul <span className="text-red-500">*</span></Label>
                <Input placeholder="Judul banner" {...register("title")} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea placeholder="Deskripsi banner" rows={2} {...register("description")} />
              </div>
              <div className="space-y-2">
                <Label>Gambar <span className="text-red-500">*</span></Label>
                <ImageUpload value={imageUrl || ""} onChange={(url) => setValue("imageUrl", url)} folder="/banner" module="banner" label={watch("title") || "banner"} />
                <span className="text-xs text-muted-foreground">Ukuran Gambar: 1920x1080px (Rasio 16:9)</span>
                {errors.imageUrl && <p className="text-xs text-destructive">{errors.imageUrl.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Teks Tombol</Label>
                  <Input placeholder="contoh: Pelajari Lebih Lanjut" {...register("buttonText")} />
                </div>
                <div className="space-y-2">
                  <Label>URL Tombol</Label>
                  <Input placeholder="/profil atau https://..." {...register("buttonUrl")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Urutan</Label>
                  <Input type="number" min={0} {...register("sortOrder", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select defaultValue={watch("isActive") ? "true" : "false"} onValueChange={(v) => setValue("isActive", v === "true")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Aktif</SelectItem>
                      <SelectItem value="false">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t">
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>Batal</Button>
              <Button type="submit" loading={saveMutation.isPending}>Simpan</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Page() {
  return <Suspense><SelokoBannersPage /></Suspense>;
}
