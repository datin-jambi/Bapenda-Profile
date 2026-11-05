import Link from "next/link";
import Image from "next/image";
import { Facebook, Twitter, Instagram, Youtube, MapPin, Clock } from "lucide-react";
import { settingRepository } from "@/repositories/content.repository";

export async function PublicFooter() {
  const settings = await settingRepository.findAll().catch(() => ({} as Record<string, string>));

  const socials = [
    { Icon: Facebook, href: settings.social_facebook, label: "Facebook" },
    { Icon: Twitter, href: settings.social_twitter, label: "Twitter" },
    { Icon: Instagram, href: settings.social_instagram, label: "Instagram" },
    { Icon: Youtube, href: settings.social_youtube, label: "YouTube" },
  ].filter((s) => s.href);

  return (
    <footer className="bg-primary text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <Image
                  src="/icons/logo.png"
                  alt="Logo BAPENDA Provinsi Jambi"
                  width={40}
                  height={40}
                  className="rounded-lg"
                  priority
                />
              </div>
              <div>
                <p className="font-bold text-white">{settings.site_name || "BAPENDA"}</p>
                <p className="text-white/70 text-xs">Provinsi Jambi</p>
              </div>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">
              Badan Pendapatan Daerah Provinsi Jambi berkomitmen memberikan pelayanan terbaik dalam pengelolaan pendapatan daerah.
            </p>
            {socials.length > 0 && (
              <div className="flex items-center gap-3">
                {socials.map(({ Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Tautan Cepat</h3>
            <ul className="space-y-2">
              {[
                { href: "/profil/sejarah", label: "Sejarah" },
                { href: "/profil/visi-misi", label: "Visi & Misi" },
                { href: "/profil/tupoksi", label: "Tupoksi" },
                { href: "/berita", label: "Berita" },
                { href: "/regulasi", label: "Regulasi" },
                { href: "/faq", label: "FAQ" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/70 hover:text-secondary text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Layanan */}
          <div>
            <h3 className="font-semibold text-white mb-4">Layanan</h3>
            <ul className="space-y-2">
              {[
                { href: "/layanan/cek-pajak", label: "Cek Pajak" },
                { href: "/layanan#njkb", label: "Info NJKB" },
                { href: "/layanan#pad", label: "Info PAD" },
                { href: "https://play.google.com/store/search?q=e%20samsat&c=apps&hl=id", label: "Signal", external: true },
                { href: "/galeri", label: "Galeri" },
                { href: "/kontak", label: "Kontak Kami" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/70 hover:text-secondary text-sm transition-colors"
                    {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontak */}
          <div>
            <h3 className="font-semibold text-white mb-4">Kontak</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-white/70">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-secondary" />
                {settings.contact_address || "Jalan Kol. Tarmizi Kodir No. 71. Pakuan Baru. Kecamatan Jambi Selatan 36138"}
              </li>
              {/* <li className="flex items-center gap-2 text-sm text-white/70">
                <Phone className="h-4 w-4 flex-shrink-0 text-secondary" />
                {settings.contact_phone || "(0741) 60436"}
              </li> */}
              {/* <li className="flex items-center gap-2 text-sm text-white/70">
                <Mail className="h-4 w-4 flex-shrink-0 text-secondary" />
                {settings.contact_email || "info@bapenda.jambiprov.go.id"}
              </li> */}
              <li className="flex items-start gap-2 text-sm text-white/70">
                <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-secondary" />
                {settings.office_hours || "Senin – Jumat: 08.00 – 16.00 WIB"}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-white/60 text-xs">
            {settings.footer_text || `© ${new Date().getFullYear()} BAPENDA Provinsi Jambi. Hak Cipta Dilindungi.`}
          </p>
          <div className="flex items-center gap-4">
            <a href="https://jambiprov.go.id" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-secondary text-xs transition-colors">
              Pemprov Jambi
            </a>
            <a href="https://poldajambi.com" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-secondary text-xs transition-colors">
              Polda Jambi
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
