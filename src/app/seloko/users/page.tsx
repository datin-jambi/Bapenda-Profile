"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterInput } from "@/lib/validations";
import { Role } from "@prisma/client";
import { useAuthStore } from "@/store";
import { z } from "zod";
import { DataTable, ColumnDef } from "@/components/seloko/data-table";
import { DataTableFilter } from "@/components/seloko/data-table-filter";
import { DataTablePagination } from "@/components/seloko/data-table-pagination";
import { ConfirmDialog } from "@/components/seloko/confirm-dialog";
import { useDebounce } from "@/hooks/use-debounce";


// ─── Types ────────────────────────────────────────────────────────────────────

type Uptd = {
  id: number;
  name: string;
};

type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  avatarUrl?: string | null;
  uptd?: Uptd | null;
  createdAt: string;
};

type UserResponse = {
  data: User[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: { value: Role; label: string }[] = [
  { value: "Super_Admin", label: "Super Admin" },
  { value: "Admin", label: "Admin" },
  { value: "Editor", label: "Editor" },
  { value: "Ketua_Uptd", label: "Ketua UPTD" },
  { value: "Admin_Uptd", label: "Admin UPTD" },
  { value: "Petugas", label: "Petugas" },
];

const resetPwSchema = z.object({ newPassword: z.string().min(8, "Min. 8 karakter") });
type ResetPwInput = z.infer<typeof resetPwSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SelokoUsersPage() {
  const { user: me } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialise state from URL params
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") ?? "all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("limit") ?? 10));

  // Debounced search — fires API after 2 s of inactivity
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

  // Sync debounced search → URL + reset page
  useEffect(() => {
    pushParams({ search: debouncedSearch, page: "1" });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<UserResponse>({
    queryKey: ["seloko-users", page, pageSize, debouncedSearch, roleFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter === "active") params.set("isActive", "true");
      if (statusFilter === "inactive") params.set("isActive", "false");
      return api.get(`/seloko/users?${params.toString()}`).then((r) => r.data);
    },
  });

  const { data: uptds } = useQuery<Uptd[]>({
    queryKey: ["uptds"],
    queryFn: () => api.get("/seloko/uptd").then((r) => r.data.data),
  });

  const users = data?.data ?? [];
  const meta = data?.meta;
  const isSuperAdmin = mounted && me?.role === "Super_Admin";

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: RegisterInput) => api.post("/seloko/users", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-users"] });
      toast.success("Pengguna berhasil dibuat");
      setCreateOpen(false);
      createReset();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal membuat pengguna"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/seloko/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seloko-users"] });
      toast.success("Pengguna dihapus");
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal menghapus pengguna"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      api.post(`/seloko/users/${id}/reset-password`, { newPassword }),
    onSuccess: () => {
      toast.success("Password berhasil direset");
      setResetOpen(false);
      resetPwReset();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || "Gagal reset password"),
  });

  // ── Forms ──────────────────────────────────────────────────────────────────

  const {
    register: createRegister,
    handleSubmit: handleCreateSubmit,
    setValue: createSetValue,
    watch: createWatch,
    reset: createReset,
    formState: { errors: createErrors, isSubmitting: isCreating },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "Editor" },
  });

  const {
    register: regReset,
    handleSubmit: handleResetSubmit,
    reset: resetPwReset,
    formState: { isSubmitting: isResetting },
  } = useForm<ResetPwInput>({
    resolver: zodResolver(resetPwSchema),
  });

  const selectedRole = createWatch("role");

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleRoleFilter(val: string) {
    setRoleFilter(val);
    setPage(1);
    pushParams({ role: val, page: "1" });
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
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
    router.replace(pathname, { scroll: false });
  }

  function openCreate() {
    createReset({ role: "Editor" });
    setCreateOpen(true);
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnDef<User>[] = [
    {
      key: "avatar",
      header: "Avatar",
      render: (u) => (
        <Avatar className="h-8 w-8">
          {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
          <AvatarFallback className="text-xs">{getInitials(u.name)}</AvatarFallback>
        </Avatar>
      ),
    },
    {
      key: "name",
      header: "Nama",
      cellClassName: "font-medium",
      render: (u) => u.name,
    },
    {
      key: "email",
      header: "Email",
      cellClassName: "text-sm text-muted-foreground",
      render: (u) => u.email,
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <Badge variant="outline" className="text-xs">
          {u.role.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (u) => (
        <Badge variant={u.isActive ? "success" : "destructive"}>
          {u.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      key: "uptd",
      header: "UPTD",
      cellClassName: "text-sm text-muted-foreground",
      render: (u) => u.uptd?.name ?? "-",
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
          <Button size="sm" variant="outline" asChild title="Edit">
            <a href={`/seloko/users/${u.id}`}>
              <Pencil className="h-3 w-3" />
            </a>
          </Button>
          {isSuperAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                title="Reset Password"
                onClick={() => { setResetTargetId(u.id); setResetOpen(true); }}
              >
                <KeyRound className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                title="Hapus"
                onClick={() => setDeleteId(u.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
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
          <h1 className="text-2xl font-bold text-primary">Manajemen Pengguna</h1>
          <p className="text-sm text-muted-foreground">Kelola akun pengguna Seloko</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openCreate} className="w-fit">
            <Plus className="mr-2 h-4 w-4" />Tambah Pengguna
          </Button>
        )}
      </div>

      {/* Filter */}
      <DataTableFilter
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Cari nama atau email..."
        isSearching={isSearching}
        onReset={handleReset}
        selects={[
          {
            value: roleFilter,
            onChange: handleRoleFilter,
            placeholder: "Semua Role",
            allLabel: "Semua Role",
            options: ROLES.map((r) => ({ label: r.label, value: r.value })),
          },
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

      {/* Table */}
      <DataTable<User>
        data={users}
        columns={columns}
        isLoading={isLoading || isSearching}
        emptyMessage="Belum ada pengguna"
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
        title="Hapus Pengguna"
        description="Pengguna yang dihapus tidak dapat dikembalikan. Lanjutkan?"
        confirmLabel="Ya, Hapus"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId, { onSettled: () => setDeleteId(null) });
        }}
      />

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Pengguna Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Lengkap <span className="text-red-500">*</span></Label>
              <Input placeholder="Nama lengkap" {...createRegister("name")} />
              {createErrors.name && <p className="text-xs text-destructive">{createErrors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" placeholder="email@bapenda.go.id" {...createRegister("email")} />
              {createErrors.email && <p className="text-xs text-destructive">{createErrors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Password <span className="text-red-500">*</span></Label>
              <Input type="password" placeholder="Min. 8 karakter" {...createRegister("password")} />
              {createErrors.password && <p className="text-xs text-destructive">{createErrors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Role <span className="text-red-500">*</span></Label>
              <Select defaultValue="Editor" onValueChange={(v) => createSetValue("role", v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(selectedRole === "Ketua_Uptd" || selectedRole === "Admin_Uptd") && (
              <div className="space-y-2">
                <Label>UPTD</Label>
                <Select onValueChange={(v) => createSetValue("uptdId", parseInt(v, 10))}>
                  <SelectTrigger><SelectValue placeholder="Pilih UPTD" /></SelectTrigger>
                  <SelectContent>
                    {uptds?.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>No. Telepon</Label>
                <Input placeholder="08xxxxxxxxxx" {...createRegister("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Jenis Kelamin</Label>
                <Select onValueChange={(v) => createSetValue("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                    <SelectItem value="Perempuan">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isCreating}>{isCreating ? "Menyimpan..." : "Buat Pengguna"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleResetSubmit((d) => {
              if (resetTargetId) resetPasswordMutation.mutate({ id: resetTargetId, newPassword: d.newPassword });
            })}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Password Baru *</Label>
              <Input type="password" placeholder="Min. 8 karakter" {...regReset("newPassword")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setResetOpen(false); resetPwReset(); }}>Batal</Button>
              <Button type="submit" disabled={isResetting}>{isResetting ? "Menyimpan..." : "Reset Password"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Page() {
  return <Suspense><SelokoUsersPage /></Suspense>;
}
