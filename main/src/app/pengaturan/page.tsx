"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuthSession } from "@/lib/use-session";
import { Moon, Sun, Shield, UserCheck, Smartphone, Info } from "lucide-react";
import { toast } from "sonner";

export default function PengaturanPage() {
  const { session } = useAuthSession();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("cymfarm_theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      if (saved === "dark") {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const handleToggleTheme = (mode: "light" | "dark") => {
    setTheme(mode);
    localStorage.setItem("cymfarm_theme", mode);
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
      toast.info("Tema gelap diaktifkan (Preview)");
    } else {
      document.documentElement.classList.remove("dark");
      toast.info("Tema terang diaktifkan");
    }
  };

  return (
    <AppShell>
      <div className="w-full space-y-5 pb-20">
        {/* Header */}
        <div className="rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-xs">
          <h2 className="text-xl font-black text-slate-900">Setelan & Pengaturan</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Konfigurasi tampilan antarmuka dan informasi akun perangkat.
          </p>
        </div>

        {/* 1. Pengaturan Tema */}
        <div className="rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-600" />
            Tema Aplikasi
          </h3>
          <p className="text-xs font-bold text-slate-500">
            Pilih mode kontras tampilan yang paling nyaman untuk mata di lapangan.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => handleToggleTheme("light")}
              className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3.5 text-xs font-black transition active:scale-95 ${
                theme === "light"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-xs"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Sun className="h-4 w-4 text-amber-500" />
              <span>Mode Terang (Light)</span>
            </button>

            <button
              onClick={() => handleToggleTheme("dark")}
              className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3.5 text-xs font-black transition active:scale-95 ${
                theme === "dark"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-xs"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Moon className="h-4 w-4 text-indigo-500" />
              <span>Mode Gelap (Dark)</span>
            </button>
          </div>
        </div>

        {/* 2. Informasi Akun Aktif */}
        <div className="rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-700" />
            Informasi Akun
          </h3>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-500">Nama Pengguna</span>
              <span className="font-black text-slate-900">{session?.displayName || "Keluarga"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-500">Role Hak Akses</span>
              <span className="rounded-lg bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-900">
                {session?.role || "USER"}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Info Aplikasi & Offline PWA */}
        <div className="rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-xs space-y-2 text-xs font-bold text-slate-500">
          <div className="flex items-center gap-2 text-slate-800 font-black">
            <Info className="h-4 w-4 text-slate-600" />
            <span>CymFarm v2.0 (Offline-First Daily Journal)</span>
          </div>
          <p>
            Aplikasi manajemen peternakan modular keluarga dengan sinkronisasi instan IndexedDB & Supabase Cloud.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
