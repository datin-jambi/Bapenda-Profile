"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import api from "@/lib/axios";
import { FallbackImage } from "@/components/ui/fallback-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Send, CheckCircle, XCircle, Eye, Images } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store";
import { ContentStatus } from "@prisma/client";
import { ConfirmDialog } from "@/components/seloko/confirm-dialog";
import { DataTableFilter } from "@/components/seloko/data-table-filter";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { useDebounce } from "@/hooks/use-debounce";


type GalleryItem = {
  id: number;
  title: string;
  description: string | null;
  coverImage: string | null;
  status: ContentStatus;
  createdAt: string;
  author: { id: number; name: string };
  _count: { items: number };
};

type GalleryResponse = {
  data: GalleryItem[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" | "outline" | "secondary" }> = {
  DRAFT: { label: "Draft", variant: "outline" },
  PENDING_REVIEW: { label: "Menunggu Review", variant: "warning" },
  APPROVED: { label: "Disetujui", variant: "info" },
  REJECTED: { label: "Ditolak", variant: "destructive" },
  PUBLISHED: { label: "Dipublikasi", variant: "success" },
};

function SelokoGalleriesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("limit") ?? 12));
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const debouncedSearch = useDebounce(searchInput, 2000);
  const isSearching = searchInput !== debouncedSearch;

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

  const { data, isLoading } = useQuery<GalleryResponse>({
    queryKey: ["seloko-galleries", page, pageSize, debouncedSearch, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      return api.get(`/seloko/galleries?${params.toString()}`).then((r) => r.data);
    },
  });

  const galleries = data?.data ?? [];
  const meta = data?.meta;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      api.patch(`/seloko/galleries/${id}`, { action }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["seloko-galleries"] });
      const labels: Record<string, string> = {
        submit: "Dikirim untuk review",
        approve: "Disetujui",
        reject: "Ditolak",
        publish: "Dipublikasi",
        unpublish: "Dibatalkan publikasi",
      };
      toast.success(labels[vars.action] || "Berhasil");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/seloko/galleries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-galleries"] });
      toast.success("Galeri dihapus");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menghapus"),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const canApprove = user?.role === "Super_Admin" || user?.role === "Admin";
  const canPublish = user?.role === "Super_Admin" || user?.role === "Admin";
  const canDelete = user?.role === "Super_Admin";

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

  // ── Skeleton grid ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-primary">Manajemen Galeri</h1>
          <p className="text-sm text-muted-foreground">Kelola foto dan video galeri</p>
        </div>
        <Button asChild>
          <Link href="/seloko/galleries/create">
            <Plus className="mr-2 h-4 w-4" />Buat Galeri
          </Link>
        </Button>
      </div>

      <DataTableFilter
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Cari judul galeri..."
        isSearching={isSearching}
        onReset={handleReset}
        selects={[
          {
            value: statusFilter,
            onChange: handleStatusFilter,
            placeholder: "Status",
            allLabel: "Semua Status",
            options: [
              { label: "Draft", value: "DRAFT" },
              { label: "Menunggu Review", value: "PENDING_REVIEW" },
              { label: "Disetujui", value: "APPROVED" },
              { label: "Ditolak", value: "REJECTED" },
              { label: "Dipublikasi", value: "PUBLISHED" },
            ],
          },
        ]}
      />

      {/* Grid */}
      {galleries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Images className="h-14 w-14 text-gray-200" />
          <p className="text-sm">Belum ada galeri ditemukan</p>
          {(searchInput || statusFilter !== "all") && (
            <Button variant="outline" size="sm" onClick={handleReset}>Reset Filter</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {galleries.map((item) => (
            <div key={item.id} className="group relative rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
              {/* Cover image */}
              <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                <FallbackImage
                  src={item.coverImage}
                  alt={item.title}
                  fallback="gallery"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
                {/* Status badge overlay */}
                <div className="absolute top-2 left-2">
                  <Badge variant={STATUS_MAP[item.status]?.variant ?? "outline"} className="text-xs shadow">
                    {STATUS_MAP[item.status]?.label ?? item.status}
                  </Badge>
                </div>
                {/* Item count overlay */}
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs rounded px-1.5 py-0.5 flex items-center gap-1">
                  <Images className="h-3 w-3" />
                  {item._count.items}
                </div>
              </div>

              {/* Card body */}
              <div className="p-3 space-y-1">
                <p className="font-medium text-sm leading-tight line-clamp-2">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                )}
                <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
              </div>

              {/* Action bar */}
              <div className="px-3 pb-3 flex items-center gap-1 flex-wrap">
                {item.status === "DRAFT" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" title="Kirim Review"
                    onClick={() => actionMutation.mutate({ id: item.id, action: "submit" })}
                    disabled={actionMutation.isPending}>
                    <Send className="h-3 w-3 mr-1" />Review
                  </Button>
                )}
                {canApprove && item.status === "PENDING_REVIEW" && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-green-600" title="Setujui"
                      onClick={() => actionMutation.mutate({ id: item.id, action: "approve" })}
                      disabled={actionMutation.isPending}>
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-red-600" title="Tolak"
                      onClick={() => actionMutation.mutate({ id: item.id, action: "reject" })}
                      disabled={actionMutation.isPending}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </>
                )}
                {canPublish && item.status === "APPROVED" && (
                  <Button size="sm" variant="default" className="h-7 text-xs" title="Publikasi"
                    onClick={() => actionMutation.mutate({ id: item.id, action: "publish" })}
                    disabled={actionMutation.isPending}>
                    <Eye className="h-3 w-3 mr-1" />Publikasi
                  </Button>
                )}
                {canPublish && item.status === "PUBLISHED" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => actionMutation.mutate({ id: item.id, action: "unpublish" })}
                    disabled={actionMutation.isPending}>
                    Batalkan
                  </Button>
                )}
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" asChild title="Edit">
                    <Link href={`/seloko/galleries/${item.id}`}><Pencil className="h-3 w-3" /></Link>
                  </Button>
                  {canDelete && (
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Hapus"
                      onClick={() => setDeleteId(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
        title="Hapus Galeri"
        description="Galeri yang dihapus tidak dapat dikembalikan. Semua foto di dalamnya juga akan dihapus. Lanjutkan?"
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
  return <Suspense><SelokoGalleriesPage /></Suspense>;
}
