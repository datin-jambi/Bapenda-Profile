"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store";
import { ConfirmDialog } from "@/components/seloko/confirm-dialog";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { DataTableFilter } from "@/components/seloko/data-table-filter";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { useDebounce } from "@/hooks/use-debounce";


type PageItem = {
  id: number;
  title: string;
  slug: string;
  isPublished: boolean;
  updatedAt: string;
};

type PageResponse = {
  data: PageItem[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

function SelokoPagesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("limit") ?? 10));
  const [deleteId, setDeleteId] = useState<number | null>(null);

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

  const { data, isLoading } = useQuery<PageResponse>({
    queryKey: ["seloko-pages", page, pageSize, debouncedSearch, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      return api.get(`/seloko/pages?${params.toString()}`).then((r) => r.data);
    },
  });

  const pages = data?.data ?? [];
  const meta = data?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/seloko/pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-pages"] });
      toast.success("Halaman dihapus");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menghapus"),
  });

  const canManage = user?.role === "Super_Admin" || user?.role === "Admin";

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

  const columns: ColumnDef<PageItem>[] = [
    {
      key: "title",
      header: "Judul",
      render: (row) => (
        <div>
          <p className="font-medium text-sm">{row.title}</p>
          <p className="text-xs text-muted-foreground">/{row.slug}</p>
        </div>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      headerClassName: "hidden md:table-cell",
      cellClassName: "hidden md:table-cell",
      render: (row) => (
        <span className="text-xs font-mono text-muted-foreground">/{row.slug}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      headerClassName: "w-32",
      render: (row) => (
        <Badge variant={row.isPublished ? "success" : "outline"}>
          {row.isPublished ? "Dipublikasi" : "Draft"}
        </Badge>
      ),
    },
    {
      key: "updatedAt",
      header: "Diperbarui",
      headerClassName: "hidden lg:table-cell w-40",
      cellClassName: "hidden lg:table-cell",
      render: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-24",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" asChild title="Edit">
            <Link href={`/seloko/pages/${row.id}/edit`}>
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {canManage && (
            <Button
              size="sm"
              variant="destructive"
              title="Hapus"
              onClick={() => setDeleteId(row.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-primary">Manajemen Halaman</h1>
          <p className="text-sm text-muted-foreground">Kelola konten halaman statis website</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/seloko/pages/create">
              <Plus className="mr-2 h-4 w-4" />Buat Halaman
            </Link>
          </Button>
        )}
      </div>

      <DataTableFilter
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Cari judul atau slug..."
        isSearching={isSearching}
        onReset={handleReset}
        selects={[
          {
            value: statusFilter,
            onChange: handleStatusFilter,
            placeholder: "Status",
            allLabel: "Semua Status",
            options: [
              { label: "Dipublikasi", value: "published" },
              { label: "Draft", value: "draft" },
            ],
          },
        ]}
      />

      <DataTable
        data={pages}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="Belum ada halaman ditemukan"
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
        title="Hapus Halaman"
        description="Halaman yang dihapus tidak dapat dikembalikan. Lanjutkan?"
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
  return <Suspense><SelokoPagesPage /></Suspense>;
}
