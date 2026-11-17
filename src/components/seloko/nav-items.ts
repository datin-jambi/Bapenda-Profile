import {
  LayoutDashboard, Newspaper, Images, HelpCircle, FileText,
  Shield, Image, Settings, Users, Building2,
  User, ScrollText, Tag, Car, ClipboardList,
} from "lucide-react";
import { Role } from "@prisma/client";

export interface NavItem {
  href: string;
  label: string;
  /** Label pendek untuk bottom tab bar mobile. */
  shortLabel?: string;
  icon: React.ElementType;
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/seloko/dashboard", label: "Dashboard", shortLabel: "Beranda", icon: LayoutDashboard },
  { href: "/seloko/pajak-kendaraan", label: "Cek Pajak", icon: Car, roles: ["Petugas"] },
  { href: "/seloko/log-pajak", label: "Log Cek Pajak", shortLabel: "Log Pajak", icon: ClipboardList, roles: ["Super_Admin", "Admin"] },
  { href: "/seloko/news", label: "Berita", icon: Newspaper, roles: ["Super_Admin", "Admin", "Editor", "Ketua_Uptd", "Admin_Uptd"] },
  { href: "/seloko/galleries", label: "Galeri", icon: Images, roles: ["Super_Admin", "Admin", "Editor", "Ketua_Uptd", "Admin_Uptd"] },
  { href: "/seloko/news-categories", label: "Kategori Berita", icon: Tag, roles: ["Super_Admin", "Admin"] },
  { href: "/seloko/faqs", label: "FAQ", icon: HelpCircle, roles: ["Super_Admin", "Admin"] },
  { href: "/seloko/faq-categories", label: "Kategori FAQ", icon: ScrollText, roles: ["Super_Admin", "Admin"] },
  { href: "/seloko/pages", label: "Halaman", icon: FileText, roles: ["Super_Admin", "Admin"] },
  { href: "/seloko/regulations", label: "Regulasi", icon: Shield, roles: ["Super_Admin", "Admin"] },
  { href: "/seloko/banners", label: "Banner", icon: Image, roles: ["Super_Admin", "Admin"] },
  { href: "/seloko/uptd", label: "UPTD", icon: Building2, roles: ["Super_Admin"] },
  { href: "/seloko/users", label: "Pengguna", icon: Users, roles: ["Super_Admin", "Admin"] },
  { href: "/seloko/settings", label: "Pengaturan", icon: Settings, roles: ["Super_Admin"] },
  { href: "/seloko/profile", label: "Profil Saya", shortLabel: "Profil", icon: User },
];

/** Menu yang boleh dilihat role tertentu; urutannya sudah prioritas tampilan. */
export function visibleNavItems(role?: string | null): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role as Role)));
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
