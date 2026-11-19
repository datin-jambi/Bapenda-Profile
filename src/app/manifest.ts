import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SELOKO",
    short_name: "SELOKO",
    description: "Aplikasi Seloko — pengelolaan konten dan cek pajak kendaraan BAPENDA Provinsi Jambi",
    start_url: "/seloko/dashboard",
    scope: "/seloko",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#03317A",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Cek Pajak Kendaraan", short_name: "Cek Pajak", url: "/seloko/pajak-kendaraan" },
      { name: "Dashboard", short_name: "Dashboard", url: "/seloko/dashboard" },
    ],
  };
}
