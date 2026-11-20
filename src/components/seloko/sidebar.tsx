"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebarStore, useAuthStore } from "@/store";
import { ChevronLeft, ChevronRight } from "lucide-react";
import NextImage from "next/image";
import { visibleNavItems, isNavActive } from "@/components/seloko/nav-items";
import { useMounted } from "@/hooks/use-mounted";

export function SelokoSidebar() {
  const pathname = usePathname();
  const { isOpen, toggle } = useSidebarStore();
  const { user } = useAuthStore();
  // Sidebar & auth dipersist di localStorage — tahan sampai mounted agar
  // render pertama klien sama dengan HTML server.
  const mounted = useMounted();
  const expanded = mounted ? isOpen : true;

  const visibleItems = visibleNavItems(mounted ? user?.role : undefined);

  return (
    <aside
      className={cn(
        // Desktop-only: di mobile navigasi ditangani bottom bar + drawer.
        "hidden md:block fixed left-0 top-0 z-40 h-screen bg-gradient-to-b from-seloko-navy to-seloko-ink text-white shadow-xl transition-all duration-300",
        expanded ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
        {expanded && (
          <Link href="/seloko/dashboard" className="flex items-center min-w-0 rounded-xl bg-white px-2.5 py-1.5 shadow-sm">
            <NextImage
              src="/images/seloko/seloko-full.png"
              alt="SELOKO"
              width={640}
              height={217}
              priority
              className="h-8 w-auto max-w-[140px] object-contain"
            />
          </Link>
        )}
        {!expanded && (
          <Link href="/seloko/dashboard" className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
            <NextImage
              src="/images/seloko/seloko-mark.png"
              alt="SELOKO"
              width={234}
              height={256}
              className="h-7 w-auto object-contain"
            />
          </Link>
        )}
        <button
          onClick={toggle}
          className={cn(
            "p-1 rounded-md hover:bg-white/10 transition-colors flex-shrink-0",
            !expanded && "hidden"
          )}
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Toggle when collapsed */}
      {!expanded && (
        <button
          onClick={toggle}
          className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:shadow-md transition-shadow"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-3 w-3 text-primary" />
        </button>
      )}

      <ScrollArea className="flex-1 h-[calc(100vh-4rem)]">
        <nav className="p-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-seloko-blue to-seloko-navy text-white shadow-md shadow-black/20 ring-1 ring-white/15"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                  !expanded && "justify-center px-2"
                )}
                title={!expanded ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
