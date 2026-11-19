"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, MoreHorizontal, LogOut, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { visibleNavItems, isNavActive, type NavItem } from "@/components/seloko/nav-items";
import { useMounted } from "@/hooks/use-mounted";

/** Jumlah tab utama di bottom bar; sisanya masuk sheet "Lainnya". */
const PRIMARY_TABS = 4;

function pageTitle(items: NavItem[], pathname: string): string {
  const match = items.find((i) => isNavActive(pathname, i.href));
  return match?.label ?? "Seloko";
}

// ─── Top app bar (mobile) ─────────────────────────────────────────────────────

export function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const mounted = useMounted();
  // Sebelum mounted, render seperti tanpa user agar cocok dengan HTML server.
  const u = mounted ? user : null;

  const items = visibleNavItems(u?.role);
  // Halaman detail/edit = bukan root menu, jadi tampilkan tombol back ala app native.
  const isRoot = items.some((i) => i.href === pathname);

  return (
    <header className="md:hidden sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-blue-500 text-white pt-[env(safe-area-inset-top)] shadow-md shadow-indigo-500/20">
      <div className="h-14 flex items-center gap-2 px-2">
        {isRoot ? (
          <div className="w-10 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.png" alt="" className="h-7 w-7 rounded-md" />
          </div>
        ) : (
          <button
            onClick={() => router.back()}
            aria-label="Kembali"
            className="h-10 w-10 flex items-center justify-center rounded-full active:bg-white/20 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <h1 className="flex-1 text-base font-semibold truncate">{pageTitle(items, pathname)}</h1>

        <Link
          href="/seloko/profile"
          aria-label="Profil saya"
          className="h-10 w-10 flex items-center justify-center"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={u?.avatarUrl || ""} alt={u?.name || ""} />
            <AvatarFallback className="bg-white/20 text-white text-xs">
              {u?.name ? getInitials(u.name) : "U"}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}

// ─── Bottom tab bar + sheet "Lainnya" (mobile) ───────────────────────────────

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const mounted = useMounted();
  const [sheetOpen, setSheetOpen] = useState(false);

  const items = visibleNavItems(mounted ? user?.role : undefined);
  const tabs = items.slice(0, PRIMARY_TABS);
  const rest = items.slice(PRIMARY_TABS);

  // Tutup sheet saat pindah halaman.
  useEffect(() => setSheetOpen(false), [pathname]);

  // Kunci scroll body selama sheet terbuka.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

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

  const restActive = rest.some((i) => isNavActive(pathname, i.href));

  return (
    <>
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button
            aria-label="Tutup menu"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40 animate-in fade-in"
          />
          <div className="relative bg-white rounded-t-2xl max-h-[75vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b">
              <div className="absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-gray-300" />
              <p className="text-sm font-semibold mt-2">{rest.length > 0 ? "Menu Lainnya" : "Akun"}</p>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="Tutup"
                className="mt-2 h-8 w-8 flex items-center justify-center rounded-full active:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              {rest.length > 0 && (
                <div className="grid grid-cols-4 gap-1">
                  {rest.map((item) => {
                    const Icon = item.icon;
                    const active = isNavActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-center active:bg-gray-100",
                          active && "bg-primary/10"
                        )}
                      >
                        <Icon className={cn("h-6 w-6", active ? "text-primary" : "text-gray-600")} />
                        <span className="text-[11px] leading-tight text-gray-700 line-clamp-2">
                          {item.shortLabel ?? item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}

              <div className={cn("space-y-1", rest.length > 0 && "mt-2 border-t pt-2")}>
                <Link
                  href="/"
                  target="_blank"
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-gray-700 active:bg-gray-100"
                >
                  <ExternalLink className="h-5 w-5 text-gray-500" />
                  Lihat Website
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-red-600 active:bg-red-50"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bar melayang: pill putih, item aktif diberi kapsul berwarna. */}
      <nav className="md:hidden fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] inset-x-3 z-40 rounded-3xl bg-white/95 backdrop-blur-md shadow-[0_8px_30px_rgba(15,23,42,0.12)] ring-1 ring-black/5">
        <div className="flex items-center justify-around px-1.5 py-1.5">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex-1 flex flex-col items-center gap-1 py-1 min-w-0 active:scale-95 transition-transform"
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active ? "bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-500/30" : "text-slate-400"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className={cn("text-[10px] leading-tight truncate max-w-full px-0.5", active ? "text-indigo-600 font-semibold" : "text-slate-500")}>
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            );
          })}

          {/* Selalu tampil: sheet ini juga memuat Logout, bukan hanya menu sisa. */}
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Menu lainnya"
            className="flex-1 flex flex-col items-center gap-1 py-1 min-w-0 active:scale-95 transition-transform"
          >
            <span
              className={cn(
                "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                restActive ? "bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-500/30" : "text-slate-400"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
            </span>
            <span className={cn("text-[10px] leading-tight", restActive ? "text-indigo-600 font-semibold" : "text-slate-500")}>
              Lainnya
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
