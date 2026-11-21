// Service worker Seloko BAPENDA — PWA installable + fallback offline.
// ponytail: cache statis app-shell saja. Ganti dengan Workbox bila butuh
// strategi per-route (stale-while-revalidate untuk API, dsb).
//
// PENTING: naikkan versi CACHE setiap rilis. Byte file ini harus berubah agar
// browser mendeteksi service worker baru dan menawarkan tombol "Perbarui".
const CACHE = "seloko-bapenda-v8";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, "/icons/v3/icon-192.png"]))
  );
  // Sengaja TIDAK skipWaiting(): versi baru menunggu sampai pengguna menekan
  // "Perbarui" di halaman Profil, supaya halaman tidak berganti versi mendadak
  // di tengah pekerjaan. Aktivasi dipicu lewat pesan SKIP_WAITING di bawah.
});

// Halaman meminta versi baru langsung aktif (tombol "Perbarui").
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Hanya navigasi yang di-handle: data Seloko harus selalu segar, tidak di-cache.
  if (req.mode !== "navigate") return;

  event.respondWith(
    fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r ?? Response.error()))
  );
});
