"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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


type FaqCategory = { id: number; name: string; slug: string };

type FaqItem = {
  id: number;
  question: string;
  slug: string;
  isPublished: boolean;
  viewCount: number;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  category: FaqCategory;
  author: { id: number; name: string };
};

type FaqResponse = {
  data: FaqItem[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
};

function SelokoFaqsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("categoryId") ?? "all");
  const [publishedFilter, setPublishedFilter] = useState(searchParams.get("isPublished") ?? "all");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("limit") ?? 10));
  const [deleteTarget, setDeleteTarget] = useState<FaqItem | null>(null);

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

  const { data: categoriesData } = useQuery<FaqCategory[]>({
    queryKey: ["faq-categories"],
    queryFn: () => api.get("/seloko/faq-categories?limit=100").then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery<FaqResponse>({
    queryKey: ["seloko-faqs", page, pageSize, debouncedSearch, categoryFilter, publishedFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (publishedFilter !== "all") params.set("isPublished", publishedFilter);
      return api.get(`/seloko/faqs?${params.toString()}`).then((r) => r.data);
    },
  });

  const faqs = data?.data ?? [];
  const meta = data?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/seloko/faqs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-faqs"] });
      queryClient.invalidateQueries({ queryKey: ["seloko-faq-categories-list"] });
      queryClient.invalidateQueries({ queryKey: ["faq-categories"] });
      toast.success("FAQ berhasil dihapus");
      setDeleteTarget(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menghapus FAQ"),
  });

  function handleCategoryFilter(val: string) {
    setCategoryFilter(val);
    setPage(1);
    pushParams({ categoryId: val, page: "1" });
  }

  function handlePublishedFilter(val: string) {
    setPublishedFilter(val);
    setPage(1);
    pushParams({ isPublished: val, page: "1" });
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
    setCategoryFilter("all");
    setPublishedFilter("all");
    setPage(1);
    router.replace(pathname, { scroll: false });
  }

  const canManage = user?.role === "Super_Admin" || user?.role === "Admin";

  const columns: ColumnDef<FaqItem>[] = [
    {
      key: "question",
      header: "Pertanyaan",
      cellClassName: "font-medium max-w-xs",
      render: (item) => (
        <span className="line-clamp-2 text-sm" title={item.question}>
          {item.question}
        </span>
      ),
    },
    {
      key: "category",
      header: "Kategori",
      render: (item) => <Badge variant="outline">{item.category?.name}</Badge>,
    },
    {
      key: "status",
      header: "Status Publish",
      render: (item) => (
        <Badge variant={item.isPublished ? "success" : "outline"}>
          {item.isPublished ? "Dipublikasi" : "Draft"}
        </Badge>
      ),
    },
    {
      key: "viewCount",
      header: "Total View",
      cellClassName: "text-sm text-muted-foreground text-center",
      headerClassName: "text-center",
      render: (item) => item.viewCount,
    },
    {
      key: "sortOrder",
      header: "Urutan",
      cellClassName: "text-sm text-muted-foreground text-center",
      headerClassName: "text-center",
      render: (item) => item.sortOrder,
    },
    {
      key: "author",
      header: "Dibuat Oleh",
      cellClassName: "text-sm text-muted-foreground",
      render: (item) => item.author?.name ?? "-",
    },
    {
      key: "createdAt",
      header: "Tanggal Dibuat",
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
            <Link href={`/seloko/faqs/${item.id}`}><Eye className="h-3 w-3" /></Link>
          </Button>
          {canManage && (
            <Button size="sm" variant="outline" asChild title="Edit">
              <Link href={`/seloko/faqs/${item.id}/edit`}><Pencil className="h-3 w-3" /></Link>
            </Button>
          )}
          {canManage && (
            <Button size="sm" variant="destructive" title="Hapus" onClick={() => setDeleteTarget(item)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const categoryOptions = (categoriesData ?? []).map((c) => ({ label: c.name, value: String(c.id) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-primary">Manajemen FAQ</h1>
          <p className="text-sm text-muted-foreground">Kelola pertanyaan yang sering diajukan</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/seloko/faqs/create"><Plus className="mr-2 h-4 w-4" />Tambah FAQ</Link>
          </Button>
        )}
      </div>

      <DataTableFilter
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Cari pertanyaan..."
        isSearching={isSearching}
        onReset={handleReset}
        selects={[
          {
            value: categoryFilter,
            onChange: handleCategoryFilter,
            placeholder: "Kategori",
            allLabel: "Semua Kategori",
            options: categoryOptions,
          },
          {
            value: publishedFilter,
            onChange: handlePublishedFilter,
            placeholder: "Status",
            allLabel: "Semua Status",
            options: [
              { label: "Dipublikasi", value: "true" },
              { label: "Draft", value: "false" },
            ],
          },
        ]}
      />

      <DataTable
        data={faqs}
        columns={columns}
        isLoading={isLoading || isSearching}
        emptyMessage="Belum ada FAQ"
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
        title="Hapus FAQ"
        description={`FAQ "${deleteTarget?.question}" akan dihapus secara permanen. Lanjutkan?`}
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
  return <Suspense><SelokoFaqsPage /></Suspense>;
}
