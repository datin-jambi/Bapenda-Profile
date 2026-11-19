"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import api from "@/lib/axios";
import { FallbackImage } from "@/components/ui/fallback-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Send, CheckCircle, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatDate, truncate } from "@/lib/utils";
import { useAuthStore } from "@/store";
import { ContentStatus } from "@prisma/client";
import { ConfirmDialog } from "@/components/seloko/confirm-dialog";
import { DataTableFilter } from "@/components/seloko/data-table-filter";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { useDebounce } from "@/hooks/use-debounce";


type NewsCategory = { id: number; name: string; slug: string };

type NewsItem = {
  id: number;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  status: ContentStatus;
  publishedAt: string | null;
  createdAt: string;
  category: NewsCategory;
  author: { id: number; name: string };
};

type NewsResponse = {
  data: NewsItem[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" | "outline" | "secondary" }> = {
  DRAFT: { label: "Draft", variant: "outline" },
  PENDING_REVIEW: { label: "Menunggu Review", variant: "warning" },
  APPROVED: { label: "Disetujui", variant: "info" },
  REJECTED: { label: "Ditolak", variant: "destructive" },
  PUBLISHED: { label: "Dipublikasi", variant: "success" },
};

function SelokoNewsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("categoryId") ?? "all");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("limit") ?? 10));
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

  const { data: categoriesData } = useQuery<NewsCategory[]>({
    queryKey: ["news-categories"],
    queryFn: () => api.get("/seloko/news-categories").then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery<NewsResponse>({
    queryKey: ["seloko-news", page, pageSize, debouncedSearch, statusFilter, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      return api.get(`/seloko/news?${params.toString()}`).then((r) => r.data);
    },
  });

  const news = data?.data ?? [];
  const meta = data?.meta;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      api.patch(`/seloko/news/${id}`, { action }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["seloko-news"] });
      const labels: Record<string, string> = {
        submit: "Dikirim untuk review", approve: "Disetujui", reject: "Ditolak",
        publish: "Dipublikasi", unpublish: "Dibatalkan publikasi",
      };
      toast.success(labels[vars.action] || "Berhasil");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/seloko/news/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-news"] });
      toast.success("Berita dihapus");
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

  function handleCategoryFilter(val: string) {
    setCategoryFilter(val);
    setPage(1);
    pushParams({ categoryId: val, page: "1" });
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
    setCategoryFilter("all");
    setPage(1);
    router.replace(pathname, { scroll: false });
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnDef<NewsItem>[] = [
    {
      key: "thumbnail",
      header: "Thumbnail",
      render: (item) => (
        <FallbackImage
          src={item.thumbnailUrl}
          alt={item.title}
          fallback="news"
          width={80}
          height={50}
          className="rounded object-cover"
          unoptimized
        />
      ),
    },
    {
      key: "title",
      header: "Judul Berita",
      cellClassName: "font-medium max-w-xs",
      render: (item) => (
        <span title={item.title}>{truncate(item.title, 60)}</span>
      ),
    },
    {
      key: "category",
      header: "Kategori",
      render: (item) => <Badge variant="outline">{item.category?.name}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <Badge variant={STATUS_MAP[item.status]?.variant ?? "outline"}>
          {STATUS_MAP[item.status]?.label ?? item.status}
        </Badge>
      ),
    },
    {
      key: "author",
      header: "Penulis",
      cellClassName: "text-sm text-muted-foreground",
      render: (item) => item.author?.name,
    },
    {
      key: "publishedAt",
      header: "Tgl Publish",
      cellClassName: "text-sm text-muted-foreground",
      render: (item) => item.publishedAt ? formatDate(item.publishedAt) : "-",
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
          {item.status === "DRAFT" && (
            <Button size="sm" variant="outline" title="Kirim Review"
              onClick={() => actionMutation.mutate({ id: item.id, action: "submit" })}>
              <Send className="h-3 w-3" />
            </Button>
          )}
          {canApprove && item.status === "PENDING_REVIEW" && (
            <>
              <Button size="sm" variant="outline" className="text-green-600" title="Setujui"
                onClick={() => actionMutation.mutate({ id: item.id, action: "approve" })}>
                <CheckCircle className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" className="text-red-600" title="Tolak"
                onClick={() => actionMutation.mutate({ id: item.id, action: "reject" })}>
                <XCircle className="h-3 w-3" />
              </Button>
            </>
          )}
          {canPublish && item.status === "APPROVED" && (
            <Button size="sm" variant="default" title="Publikasi"
              onClick={() => actionMutation.mutate({ id: item.id, action: "publish" })}>
              <Eye className="h-3 w-3 mr-1" />Publikasi
            </Button>
          )}
          <Button size="sm" variant="outline" asChild title="Edit">
            <Link href={`/seloko/news/${item.id}`}><Pencil className="h-3 w-3" /></Link>
          </Button>
          {canDelete && (
            <Button size="sm" variant="destructive" title="Hapus"
              onClick={() => setDeleteId(item.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  const categoryOptions = (categoriesData ?? []).map((c) => ({
    label: c.name,
    value: String(c.id),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-primary">Manajemen Berita</h1>
          <p className="text-sm text-muted-foreground">Kelola semua artikel berita</p>
        </div>
        <Button asChild>
          <Link href="/seloko/news/create"><Plus className="mr-2 h-4 w-4" />Buat Berita</Link>
        </Button>
      </div>

      <DataTableFilter
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Cari judul berita..."
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
          {
            value: categoryFilter,
            onChange: handleCategoryFilter,
            placeholder: "Kategori",
            allLabel: "Semua Kategori",
            options: categoryOptions,
          },
        ]}
      />

      <DataTable
        data={news}
        columns={columns}
        isLoading={isLoading || isSearching}
        emptyMessage="Belum ada berita"
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
        title="Hapus Berita"
        description="Berita yang dihapus tidak dapat dikembalikan. Gambar thumbnail juga akan dihapus. Lanjutkan?"
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
  return <Suspense><SelokoNewsPage /></Suspense>;
}
