import type { Metadata, Viewport } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import NextTopLoader from "nextjs-toploader";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "BAPENDA Provinsi Jambi",
    template: "%s | BAPENDA Provinsi Jambi",
  },
  description: "Website Resmi Badan Pendapatan Daerah Provinsi Jambi",
  // Wajib agar browser menemukan manifest — tanpa ini nama/ikon PWA tidak
  // pernah ter-update di perangkat yang sudah memasang aplikasi.
  manifest: "/manifest.webmanifest",
  keywords: ["bapenda", "jambi", "pajak", "samsat", "pkb"],
  authors: [{ name: "BAPENDA Provinsi Jambi" }],
  creator: "BAPENDA Provinsi Jambi",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  icons: {
    icon: [{ url: "/favicon.ico", type: "image/x-icon" }],
    shortcut: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "BAPENDA Provinsi Jambi",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SELOKO",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Standalone PWA: cegah zoom-bounce saat tap input di iOS.
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1a3a6e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${poppins.variable} ${inter.variable} font-inter antialiased`}>
        <NextTopLoader
          color="#f97316"
          height={3}
          showSpinner={false}
          shadow={false}
        />
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}

