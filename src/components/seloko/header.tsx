"use client";

import { useAuthStore, useSidebarStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, User, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/axios";
import { getInitials } from "@/lib/utils";
import Link from "next/link";
import { useMounted } from "@/hooks/use-mounted";

export function SelokoHeader() {
  const { user, clearUser } = useAuthStore();
  const { toggle } = useSidebarStore();
  const router = useRouter();
  // Auth dipersist di localStorage; sebelum mounted render tanpa user.
  const u = useMounted() ? user : null;

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
      clearUser();
      router.push("/seloko/login");
      toast.success("Berhasil logout");
    } catch {
      clearUser();
      router.push("/seloko/login");
    }
  }

  return (
    <header className="hidden lg:flex h-16 border-b bg-white items-center justify-between px-4 sticky top-0 z-30">
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle menu">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-3">
        <Link href="/" target="_blank" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
          <ExternalLink className="h-4 w-4" />
          <span className="hidden sm:inline">Lihat Website</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={u?.avatarUrl || ""} alt={u?.name || ""} />
                <AvatarFallback className="bg-primary text-white text-xs">
                  {u?.name ? getInitials(u.name) : "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{u?.name}</p>
                <p className="text-xs text-muted-foreground">{u?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{u?.role?.replace("_", " ")}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/seloko/profile">
                <User className="mr-2 h-4 w-4" />
                Profil Saya
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
