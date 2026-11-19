"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store";
import { ConfirmDialog } from "@/components/seloko/confirm-dialog";
import { DataTableFilter } from "@/components/seloko/data-table-filter";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { useDebounce } from "@/hooks/use-debounce";


type NewsCategoryItem = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  _count: { news: number };
};

type CategoryResponse = {
  data: NewsCategoryItem[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

function SelokoNewsCategoriesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [activeFilter, setActiveFilter] = useState(searchParams.get("isActive") ?? "all");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("limit") ?? 10));
  const [deleteTarget, setDeleteTarget] = useState<NewsCategoryItem | null>(null);

  const debouncedSearch = useDebounce(searchInput, 2000);
  const isSearching = searchInput !== debouncedSearch;

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

  const { data, isLoading } = useQuery<CategoryResponse>({
    queryKey: ["seloko-news-categories-list", page, pageSize, debouncedSearch, activeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (activeFilter !== "all") params.set("isActive", activeFilter);
      return api.get(`/seloko/news-categories?${params.toString()}`).then((r) => r.data);
    },
  });

  const categories = data?.data ?? [];
  const meta = data?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/seloko/news-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-news-categories-list"] });
      queryClient.invalidateQueries({ queryKey: ["news-categories"] });
      toast.success("Kategori berhasil dihapus");
      setDeleteTarget(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menghapus kategori"),
  });

  function handleActiveFilter(val: string) {
    setActiveFilter(val);
    setPage(1);
    pushParams({ isActive: val, page: "1" });
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
    setActiveFilter("all");
    setPage(1);
    router.replace(pathname, { scroll: false });
  }

  const canManage = user?.role === "Super_Admin" || user?.role === "Admin";

  const columns: ColumnDef<NewsCategoryItem>[] = [
    {
      key: "name",
      header: "Nama Kategori",
      cellClassName: "font-medium",
      render: (item) => (
        <div>
          <p className="font-medium text-sm">{item.name}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      cellClassName: "text-sm text-muted-foreground font-mono",
      render: (item) => item.slug,
    },
    {
      key: "news",
      header: "Total Berita",
      headerClassName: "text-center",
      cellClassName: "text-center",
      render: (item) => (
        <Badge variant="secondary">{item._count.news} Berita</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <Badge variant={item.isActive ? "success" : "outline"}>
          {item.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      key: "sortOrder",
      header: "Urutan",
      headerClassName: "text-center",
      cellClassName: "text-center text-sm text-muted-foreground",
      render: (item) => item.sortOrder,
    },
    {
      key: "createdAt",
      header: "Dibuat",
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
          <Button size="sm" variant="outline" asChild title="Detail">
            <Link href={`/seloko/news-categories/${item.id}`}><Eye className="h-3 w-3" /></Link>
          </Button>
          {canManage && (
            <Button size="sm" variant="outline" asChild title="Edit">
              <Link href={`/seloko/news-categories/${item.id}/edit`}><Pencil className="h-3 w-3" /></Link>
            </Button>
          )}
          {canManage && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm" variant="destructive" title="Hapus"
                      onClick={() => setDeleteTarget(item)}
                      disabled={item._count.news > 0}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {item._count.news > 0 && (
                  <TooltipContent>
                    <p>Tidak dapat dihapus — masih digunakan oleh {item._count.news} berita</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-primary">Kategori Berita</h1>
          <p className="text-sm text-muted-foreground">Kelola kategori untuk pengelompokan berita</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/seloko/news-categories/create"><Plus className="mr-2 h-4 w-4" />Tambah Kategori</Link>
          </Button>
        )}
      </div>

      <DataTableFilter
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Cari nama kategori..."
        isSearching={isSearching}
        onReset={handleReset}
        selects={[
          {
            value: activeFilter,
            onChange: handleActiveFilter,
            placeholder: "Status",
            allLabel: "Semua Status",
            options: [
              { label: "Aktif", value: "true" },
              { label: "Nonaktif", value: "false" },
            ],
          },
        ]}
      />

      <DataTable
        data={categories}
        columns={columns}
        isLoading={isLoading || isSearching}
        emptyMessage="Belum ada kategori berita"
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
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Hapus Kategori Berita"
        description={`Kategori "${deleteTarget?.name}" akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense><SelokoNewsCategoriesPage /></Suspense>;
}
