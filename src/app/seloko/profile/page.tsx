"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateUserSchema, changePasswordSchema, UpdateUserInput, ChangePasswordInput } from "@/lib/validations";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Eye, EyeOff, LogOut, Download, CheckCircle2, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInstallApp, useAppUpdate } from "@/components/seloko/pwa-provider";

export default function SelokoProfilePage() {
  const { user: storeUser, setUser, clearUser } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { canInstall, installed, install } = useInstallApp();
  const { updateReady, updating, applyUpdate } = useAppUpdate();

  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me").then((r) => r.data.data),
  });

  const profileForm = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  useEffect(() => {
    if (me) {
      profileForm.reset({ name: me.name, email: me.email, phone: me.phone, gender: me.gender });
    }
  }, [me, profileForm]);

  const profileMutation = useMutation({
    mutationFn: (data: UpdateUserInput) => api.put(`/seloko/users/${me?.id}`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      if (storeUser) setUser({ ...storeUser, name: res.data.data.name });
      toast.success("Profil berhasil diperbarui");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => toast.error(err.response?.data?.message || "Gagal"),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: ChangePasswordInput) =>
      api.put(`/seloko/users/${me?.id}/password`, data),
    onSuccess: () => { passwordForm.reset(); toast.success("Password berhasil diubah"); },
    onError: (err: { response?: { data?: { message?: string } } }) => toast.error(err.response?.data?.message || "Gagal mengubah password"),
  });

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
      toast.success("Berhasil logout");
    } catch {
      // Sesi lokal tetap dibersihkan walau request gagal.
    }
    clearUser();
    router.push("/seloko/login");
  }

  if (isLoading) return (
    <div className="space-y-4 max-w-2xl">
      <Skeleton className="h-40 w-full rounded-3xl" />
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Kartu identitas: gradasi + avatar besar, judul halaman tidak perlu di HP. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 p-5 text-white shadow-lg shadow-blue-500/25">
        <div aria-hidden className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15" />
        <div aria-hidden className="absolute right-10 -bottom-10 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="rounded-full bg-white/25 p-1">
            <Avatar className="h-16 w-16 ring-2 ring-white/60">
              <AvatarImage src={me?.avatarUrl || ""} />
              <AvatarFallback className="bg-white text-indigo-600 text-lg font-bold">
                {me?.name ? getInitials(me.name) : "U"}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold truncate">{me?.name}</p>
            <p className="text-sm text-white/85 truncate">{me?.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-semibold capitalize">
                {me?.role?.replace(/_/g, " ")}
              </span>
              {me?.uptd && (
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] truncate max-w-full">{me.uptd.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Data pribadi */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Data pribadi</h2>
        <form
          onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))}
          className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Nama Lengkap</Label>
            <Input className="h-12 rounded-xl text-base md:h-10 md:text-sm" {...profileForm.register("name")} />
            {profileForm.formState.errors.name && (
              <p className="text-xs text-destructive">{profileForm.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" className="h-12 rounded-xl text-base md:h-10 md:text-sm" {...profileForm.register("email")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>No. Telepon</Label>
              <Input
                className="h-12 rounded-xl text-base md:h-10 md:text-sm"
                inputMode="tel"
                {...profileForm.register("phone")}
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Kelamin</Label>
              <Controller
                control={profileForm.control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger className="h-12 w-full rounded-xl text-base md:h-10 md:text-sm">
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                      <SelectItem value="Perempuan">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <Button
            type="submit"
            loading={profileMutation.isPending}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 border-0 text-white md:h-10 md:w-auto"
          >
            Simpan Perubahan
          </Button>
        </form>
      </section>

      {/* Ubah password */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Keamanan</h2>
        <form
          onSubmit={passwordForm.handleSubmit((d) => passwordMutation.mutate(d))}
          className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 space-y-4"
        >
          {[
            { label: "Password Saat Ini", field: "currentPassword" as const, show: showCurrent, toggle: () => setShowCurrent(!showCurrent) },
            { label: "Password Baru", field: "newPassword" as const, show: showNew, toggle: () => setShowNew(!showNew) },
            { label: "Konfirmasi Password Baru", field: "confirmPassword" as const, show: showConfirm, toggle: () => setShowConfirm(!showConfirm) },
          ].map((f) => (
            <div key={f.field} className="space-y-1.5">
              <Label>{f.label}</Label>
              <div className="relative">
                <Input
                  type={f.show ? "text" : "password"}
                  autoComplete={f.field === "currentPassword" ? "current-password" : "new-password"}
                  className="h-12 rounded-xl pr-12 text-base md:h-10 md:text-sm"
                  {...passwordForm.register(f.field)}
                />
                <button
                  type="button"
                  onClick={f.toggle}
                  aria-label={f.show ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
                >
                  {f.show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {f.field === "newPassword" && passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
              )}
              {f.field === "confirmPassword" && passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
          ))}
          <Button
            type="submit"
            variant="outline"
            disabled={passwordMutation.isPending}
            className="h-12 w-full rounded-xl md:h-10 md:w-auto"
          >
            {passwordMutation.isPending ? "Mengubah..." : "Ubah Password"}
          </Button>
        </form>
      </section>

      {/* Aplikasi: install & update PWA */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Aplikasi</h2>
        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5 divide-y">
          <div className="flex items-center gap-3 p-4">
            <span className="h-10 w-10 shrink-0 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Download className="h-5 w-5 text-indigo-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">SELOKO</p>
              <p className="text-xs text-muted-foreground">
                {installed
                  ? "Sudah terpasang di perangkat ini"
                  : canInstall
                    ? "Pasang agar bisa dibuka dari layar utama"
                    : "Menu browser → Tambahkan ke layar utama"}
              </p>
            </div>
            {installed ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Terpasang
              </span>
            ) : (
              <Button type="button" size="sm" onClick={install} disabled={!canInstall} className="rounded-xl">
                Pasang
              </Button>
            )}
          </div>
          {updateReady && (
            <div className="flex items-center gap-3 p-4">
              <span className="h-10 w-10 shrink-0 rounded-2xl bg-amber-50 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-amber-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Versi baru tersedia</p>
                <p className="text-xs text-muted-foreground">Perbarui untuk memakai versi terkini</p>
              </div>
              <Button type="button" size="sm" onClick={applyUpdate} loading={updating} className="rounded-xl">
                Perbarui
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Logout: aksi terpisah di bawah, gaya tombol berbahaya. */}
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-2xl border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={handleLogout}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Keluar dari akun
      </Button>
    </div>
  );
}
