"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Download, X, Smartphone, Check } from "lucide-react";

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Daftarkan Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker aktif:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] SW register notice:", err);
        });
    }

    // 2. Cek apakah sudah running sebagai PWA standalone
    if (
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true)
    ) {
      setIsInstalled(true);
      return;
    }

    // 3. Cek apakah user sebelumnya pernah dismiss prompt ini (delay 24 jam / 1 hari)
    const dismissedAt = localStorage.getItem("cymfarm_pwa_dismissed_at");
    if (dismissedAt) {
      const oneDayMs = 24 * 60 * 60 * 1000;
      const timePassed = Date.now() - Number(dismissedAt);
      if (timePassed < oneDayMs) {
        return; // belum lewat 24 jam, jangan tampilkan dulu
      }
    }

    // 4. Tangkap event beforeinstallprompt (Chrome / Android / Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Fallback: Jika dalam 2 detik browser tidak mentrigger beforeinstallprompt (misal non-HTTPS / iOS / browser HP lain)
    // dan user belum pernah dismiss dalam 24 jam, TETAP TAMPILKAN prompt info instalasi!
    const fallbackTimer = setTimeout(() => {
      setShowPrompt(true);
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setShowPrompt(false);
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback info untuk iOS / browser lain
      alert(
        "Untuk memasang aplikasi di HP:\n1. Buka menu browser (ikon titik tiga atau tombol Share di Safari)\n2. Pilih 'Tambahkan ke Layar Utama' (Add to Home Screen)"
      );
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Simpan timestamp saat ini, akan muncul lagi setelah 24 jam (1 hari)
    localStorage.setItem("cymfarm_pwa_dismissed_at", Date.now().toString());
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div className="fixed bottom-20 inset-x-3 sm:inset-x-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-3xl border-2 border-emerald-600 bg-white p-4 sm:p-5 shadow-2xl relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 shadow-sm overflow-hidden p-1.5">
            <Image
              src="/icon.svg"
              alt="CymFarm"
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </div>

          <div>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-950">
              Instal Aplikasi di Layar HP
            </span>
            <h4 className="text-sm font-black text-slate-900 mt-1">
              Pasang CymFarm di HP Anda
            </h4>
            <p className="text-xs font-bold text-slate-500 mt-0.5 leading-snug">
              Bisa dibuka kapan saja langsung dari layar utama tanpa kuota internet saat berada di kandang.
            </p>
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-100 transition"
          >
            Nanti Saja
          </button>
          <button
            onClick={handleInstallClick}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white hover:bg-emerald-800 shadow-sm active:scale-95 transition"
          >
            <Download className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Pasang Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  );
}
