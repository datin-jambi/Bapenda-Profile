"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Eye, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/seloko/confirm-dialog";
import { DataTableFilter } from "@/components/seloko/data-table-filter";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { PdfUpload } from "@/components/seloko/pdf-upload";
import { PdfPreviewDialog } from "@/components/seloko/pdf-preview-dialog";
import { useDebounce } from "@/hooks/use-debounce";

import { regulationSchema, RegulationInput } from "@/lib/validations";
import { ContentStatus } from "@prisma/client";

type RegulationItem = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  fileUrl: string;
  fileId: string | null;
  fileName: string | null;
  status: ContentStatus;
  createdAt: string;
  publishedAt: string | null;
};

type RegulationResponse = {
  data: RegulationItem[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

const STATUS_OPTIONS = [
  { label: "Draft", value: "DRAFT" },
  { label: "Dipublikasi", value: "PUBLISHED" },
];

const STATUS_BADGE: Record<string, { label: string; variant: "outline" | "success" }> = {
  DRAFT: { label: "Draft", variant: "outline" },
  PUBLISHED: { label: "Dipublikasi", variant: "success" },
};

const defaultValues: RegulationInput = {
  title: "",
  slug: "",
  description: "",
  fileUrl: "",
  fileId: "",
  fileName: "",
  status: "DRAFT",
};

function SelokoRegulationsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("limit") ?? 10));
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<RegulationItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchInput, 2000);
  const isSearching = searchInput !== debouncedSearch;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<RegulationInput>({
    resolver: zodResolver(regulationSchema),
    defaultValues,
  });

  const fileUrl = watch("fileUrl");
  const fileId = watch("fileId");
  const fileName = watch("fileName");

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

  const { data, isLoading } = useQuery<RegulationResponse>({
    queryKey: ["seloko-regulations", page, pageSize, debouncedSearch, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      return api.get(`/seloko/regulations?${params.toString()}`).then((r) => r.data);
    },
  });

  const regulations = data?.data ?? [];
  const meta = data?.meta;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (payload: RegulationInput & { oldFileId?: string }) => {
      const { oldFileId, ...body } = payload;
      const res = editItem
        ? await api.put(`/seloko/regulations/${editItem.id}`, { ...body, oldFileId })
        : await api.post("/seloko/regulations", body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-regulations"] });
      toast.success(editItem ? "Regulasi diperbarui" : "Regulasi dibuat");
      setFormOpen(false);
      setEditItem(null);
      reset(defaultValues);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menyimpan"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/seloko/regulations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-regulations"] });
      toast.success("Regulasi dihapus");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menghapus"),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openCreate() {
    setEditItem(null);
    reset(defaultValues);
    setFormOpen(true);
  }

  function openEdit(item: RegulationItem) {
    setEditItem(item);
    reset({
      title: item.title,
      slug: item.slug,
      description: item.description ?? "",
      fileUrl: item.fileUrl,
      fileId: item.fileId ?? "",
      fileName: item.fileName ?? "",
      status: item.status,
    });
    setFormOpen(true);
  }

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

  function onSubmit(values: RegulationInput) {
    saveMutation.mutate({
      ...values,
      oldFileId: editItem?.fileId ?? undefined,
    });
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnDef<RegulationItem>[] = [
    {
      key: "title",
      header: "Judul",
      cellClassName: "font-medium max-w-xs",
      render: (item) => (
        <div>
          <p className="font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.slug}</p>
        </div>
      ),
    },
    {
      key: "fileName",
      header: "File",
      render: (item) => (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <FileText className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
          <span className="truncate max-w-[160px]">{item.fileName || "PDF"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <Badge variant={STATUS_BADGE[item.status]?.variant ?? "outline"}>
          {STATUS_BADGE[item.status]?.label ?? item.status}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Tgl Dibuat",
      cellClassName: "text-sm text-muted-foreground",
      render: (item) => formatDate(item.createdAt),
    },
    {
      key: "actions",
      header: "Aksi",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" title="Preview PDF" onClick={() => setPreviewUrl(item.fileUrl)}>
            <Eye className="h-3 w-3" />
          </Button>
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            title="Download PDF"
          >
            <Button size="sm" variant="outline" type="button">
              <Download className="h-3 w-3" />
            </Button>
          </a>
          <Button size="sm" variant="outline" title="Edit" onClick={() => openEdit(item)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="destructive" title="Hapus" onClick={() => setDeleteId(item.id)}>
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
        <div>
          <h1 className="text-2xl font-bold text-primary">Manajemen Regulasi</h1>
          <p className="text-sm text-muted-foreground">Kelola peraturan dan dokumen regulasi</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />Tambah Regulasi
        </Button>
      </div>

      <DataTableFilter
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Cari judul regulasi..."
        isSearching={isSearching}
        onReset={handleReset}
        selects={[
          {
            value: statusFilter,
            onChange: handleStatusFilter,
            placeholder: "Status",
            allLabel: "Semua Status",
            options: STATUS_OPTIONS,
          },
        ]}
      />

      <DataTable
        data={regulations}
        columns={columns}
        isLoading={isLoading || isSearching}
        emptyMessage="Belum ada regulasi"
      />

      <DataTablePagination
        page={page}
        totalPages={meta?.totalPages ?? 1}
        totalItems={meta?.totalItems ?? 0}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); setEditItem(null); reset(defaultValues); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Regulasi" : "Tambah Regulasi Baru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Judul <span className="text-destructive">*</span></Label>
              <Input placeholder="Judul regulasi" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea placeholder="Deskripsi singkat regulasi" rows={3} {...register("description")} />
            </div>

            <div className="space-y-2">
              <Label>Status <span className="text-destructive">*</span></Label>
              <Select
                value={watch("status") ?? "DRAFT"}
                onValueChange={(v) => setValue("status", v as ContentStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>File PDF <span className="text-destructive">*</span></Label>
              <PdfUpload
                value={fileUrl || ""}
                fileId={fileId || ""}
                fileName={fileName || ""}
                onChange={(url, fid, fname) => {
                  setValue("fileUrl", url);
                  setValue("fileId", fid ?? "");
                  setValue("fileName", fname ?? "");
                }}
              />
              {errors.fileUrl && <p className="text-xs text-destructive">{errors.fileUrl.message}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setFormOpen(false); setEditItem(null); reset(defaultValues); }}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
                {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Modal */}
      <PdfPreviewDialog
        open={!!previewUrl}
        onOpenChange={(v) => { if (!v) setPreviewUrl(null); }}
        url={previewUrl}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="Hapus Regulasi"
        description="Regulasi yang dihapus tidak dapat dikembalikan. File PDF juga akan dihapus dari storage. Lanjutkan?"
        confirmLabel="Ya, Hapus"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId, { onSettled: () => setDeleteId(null) });
        }}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense><SelokoRegulationsPage /></Suspense>;
}
