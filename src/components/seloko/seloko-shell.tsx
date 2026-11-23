"use client";

import { useSidebarStore } from "@/store";
import { SelokoSidebar } from "@/components/seloko/sidebar";
import { SelokoHeader } from "@/components/seloko/header";
import { MobileTopBar, MobileTabBar } from "@/components/seloko/mobile-nav";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useMounted } from "@/hooks/use-mounted";

export function SelokoShell({ children }: { children: React.ReactNode }) {
  const { isOpen } = useSidebarStore();
  const mounted = useMounted();
  const pathname = usePathname();

  const isAuthPage = pathname === "/seloko/login";

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SelokoSidebar />
      <MobileTopBar />
      <div
        className={cn(
          "transition-all duration-300",
          // Margin sidebar hanya berlaku dari breakpoint lg ke atas (tablet pakai layout mobile).
          mounted ? (isOpen ? "lg:ml-64" : "lg:ml-16") : "lg:ml-64"
        )}
      >
        <SelokoHeader />
        {/* pb menyisakan ruang untuk bottom tab bar di mobile. */}
        <main className="seloko-main p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
