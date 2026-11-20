"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X, WifiOff } from "lucide-react";
import { useInstallStore, type InstallPromptEvent } from "@/store";

const DISMISS_KEY = "seloko-install-dismissed";

/** Deteksi aplikasi sudah berjalan sebagai PWA terpasang. */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari belum mendukung display-mode standalone.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * Hook install PWA. Prompt disimpan di store supaya tombol di halaman Profil
 * tetap berfungsi walau banner sudah ditutup.
 */
export function useInstallApp() {
  const { event, setEvent } = useInstallStore();
  const [installed, setInstalled] = useState(false);

  useEffect(() => setInstalled(isStandalone()), []);

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Prompt hangus setelah dipakai — Chromium menolak prompt() kedua.
    setEvent(null);
    if (outcome === "accepted") setInstalled(true);
  }

  return { canInstall: !!event, installed, install };
}

/**
 * Deteksi versi baru aplikasi (service worker menunggu) + tombol terapkan.
 *
 * `sw.js` sengaja tidak memanggil skipWaiting(), jadi versi baru berhenti di
 * state "waiting" sampai pengguna menekan Perbarui. Setelah diaktifkan,
 * `controllerchange` memicu reload sekali supaya seluruh aset ikut versi baru.
 */
export function useAppUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [upToDate, setUpToDate] = useState(false);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    function onControllerChange() {
      // Guard: controllerchange bisa terpanggil lebih dari sekali.
      if (reloading) return;
      reloading = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let reg: ServiceWorkerRegistration | undefined;
    function track(r: ServiceWorkerRegistration) {
      reg = r;
      regRef.current = r;
      if (r.waiting) setWaiting(r.waiting);
      r.addEventListener("updatefound", () => {
        const sw = r.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          // installed + ada controller = versi baru siap menggantikan yang lama.
          if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
        });
      });
    }

    navigator.serviceWorker.getRegistration().then((r) => r && track(r));
    // Cek berkala supaya update tetap terdeteksi di sesi yang lama terbuka.
    const timer = setInterval(() => reg?.update().catch(() => {}), 60 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      clearInterval(timer);
    };
  }, []);

  function applyUpdate() {
    if (!waiting) return;
    setUpdating(true);
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  /** Cek manual ke server. Hasilnya muncul sebagai tombol Perbarui atau status "terbaru". */
  async function checkForUpdate() {
    const r = regRef.current;
    if (!r) return;
    setChecking(true);
    setUpToDate(false);
    try {
      await r.update();
      if (r.waiting) setWaiting(r.waiting);
      else setUpToDate(!r.installing);
    } catch {
      setUpToDate(false);
    } finally {
      setChecking(false);
    }
  }

  return { updateReady: !!waiting, updating, applyUpdate, checking, upToDate, checkForUpdate };
}

/**
 * Daftarkan service worker + tawarkan install (Android/Chrome) dan
 * tampilkan banner saat offline. Hanya dipasang di area /seloko.
 */
export function PwaProvider() {
  const setEvent = useInstallStore((s) => s.setEvent);
  const { canInstall, install } = useInstallApp();
  const [dismissed, setDismissed] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(
        (r) => {
          // Paksa cek versi baru tiap kali app-shell dimuat.
          r.update().catch(() => {});
        },
        () => {
          // SW opsional: Seloko tetap jalan penuh tanpa dukungan offline.
        }
      );
    }

    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    }
    function onInstalled() {
      setEvent(null);
    }
    function syncOnline() {
      setOffline(!navigator.onLine);
    }

    syncOnline();
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, [setEvent]);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <>
      {offline && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-white text-xs font-medium py-1.5 text-center pt-[calc(0.375rem+env(safe-area-inset-top))]">
          <WifiOff className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
          Tidak ada koneksi internet
        </div>
      )}

      {canInstall && !dismissed && (
        <div className="md:hidden fixed inset-x-3 z-50 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] bg-white border border-gray-200 rounded-2xl shadow-lg p-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">Pasang SELOKO</p>
            <p className="text-xs text-muted-foreground">Akses lebih cepat langsung dari layar utama</p>
          </div>
          <button
            onClick={install}
            className="flex-shrink-0 bg-primary text-white text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Pasang
          </button>
          <button onClick={handleDismiss} aria-label="Tutup" className="flex-shrink-0 p-1 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
