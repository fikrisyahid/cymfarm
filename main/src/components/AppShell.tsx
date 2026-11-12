"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Menu,
  X,
  LogOut,
  MapPin,
  Bird,
  Fish,
  Timer,
  Check,
  QrCode,
  BarChart3,
  Settings,
  UserCheck,
} from "lucide-react";
import { localDb } from "@/lib/offline-db";
import { useAuthSession } from "@/lib/use-session";

interface AppShellProps {
  children: React.ReactNode;
  activeContainerCode?: string;
  onSelectContainerCode?: (code: string) => void;
}

export function AppShell({
  children,
  activeContainerCode,
  onSelectContainerCode,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuthSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Ambil data lokasi untuk sidebar
  const containers = useLiveQuery(
    () => localDb.containers.orderBy("sortOrder").toArray(),
    [],
    []
  );

  const scanTargets = (containers || []).filter(
    (c) =>
      c.containerType === "CAGE_SET" ||
      c.containerType === "POND" ||
      c.containerType === "QUARANTINE_BUCKET"
  );

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("cymfarm_user_session");
    }
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  };

  const handleSelectLocation = (code: string) => {
    if (onSelectContainerCode) {
      onSelectContainerCode(code);
    } else {
      router.push(`/lapangan?loc=${code}`);
    }
    setSidebarOpen(false);
  };

  return (
    <div className="relative min-h-screen bg-white text-slate-900">
      {/* 1. TOP MINIMAL BAR: Cuma Icon Hamburger (Sidebar) + Nama Halaman Singkat */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-800 active:scale-95"
          aria-label="Buka Menu & Lokasi"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="text-center font-black text-slate-900">
          {pathname.startsWith("/lapangan")
            ? activeContainerCode || "Area Kandang"
            : pathname.startsWith("/analisa")
              ? "Analisa & Pakan"
              : "Admin & Modul"}
        </div>

        {/* Dummy spacer to balance hamburger icon */}
        <div className="h-11 w-11" />
      </div>

      {/* 2. MAIN CONTENT (Padding bawah cukup biar gak ketutup bottom navbar) */}
      <main className="pb-20">{children}</main>

      {/* 3. BOTTOM NAVBAR MOBILE-STYLE (Fixed di paling bawah layar) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t-2 border-slate-200 bg-white/95 shadow-lg backdrop-blur">
        <Link
          href="/lapangan"
          className={`flex flex-1 flex-col items-center justify-center py-1 transition ${
            pathname.startsWith("/lapangan")
              ? "text-emerald-700 font-black"
              : "text-slate-500 font-bold hover:text-slate-800"
          }`}
        >
          <QrCode className="h-6 w-6" />
          <span className="text-[11px]">Area</span>
        </Link>

        <Link
          href="/analisa"
          className={`flex flex-1 flex-col items-center justify-center py-1 transition ${
            pathname.startsWith("/analisa")
              ? "text-emerald-700 font-black"
              : "text-slate-500 font-bold hover:text-slate-800"
          }`}
        >
          <BarChart3 className="h-6 w-6" />
          <span className="text-[11px]">Analisa</span>
        </Link>

        {session?.role === "ADMIN" && (
          <Link
            href="/admin"
            className={`flex flex-1 flex-col items-center justify-center py-1 transition ${
              pathname.startsWith("/admin")
                ? "text-sky-700 font-black"
                : "text-slate-500 font-bold hover:text-slate-800"
            }`}
          >
            <Settings className="h-6 w-6" />
            <span className="text-[11px]">Admin</span>
          </Link>
        )}
      </nav>

      {/* 4. TOGGLEABLE SIDEBAR (Isi: Semua Lokasi + Logout Sticky di Bawah) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 transition-opacity backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[85%] max-w-sm flex-col bg-white shadow-2xl"
          >
            {/* Header Sidebar */}
            <div className="flex items-center justify-between border-b-2 border-slate-200 p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700 text-lg font-black text-white">
                  CF
                </div>
                <div>
                  <div className="text-lg font-black leading-tight text-slate-900">
                    CymFarm
                  </div>
                  {session && (
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                      <span>{session.displayName}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Title Lokasi */}
            <div className="flex items-center gap-2 px-4 pt-4 text-xs font-black uppercase tracking-wider text-slate-500">
              <MapPin className="h-4 w-4 text-emerald-700" />
              <span>Daftar Seluruh Lokasi / Area</span>
            </div>

            {/* List Lokasi SCROLLABLE */}
            <div className="flex-1 space-y-2 overflow-y-auto p-4 pr-3">
              {scanTargets.map((target) => {
                const isSelected = activeContainerCode === target.code;
                const isBucket = target.containerType === "QUARANTINE_BUCKET";
                const isPond = target.containerType === "POND";

                return (
                  <button
                    key={target.id}
                    onClick={() => handleSelectLocation(target.code)}
                    className={`flex w-full items-center justify-between rounded-2xl border-2 p-3.5 text-left transition active:scale-98 ${
                      isSelected
                        ? "border-emerald-700 bg-emerald-50 text-emerald-950 font-black shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isBucket ? (
                        <Timer className="h-6 w-6 text-amber-600 shrink-0" />
                      ) : isPond ? (
                        <Fish className="h-6 w-6 text-sky-600 shrink-0" />
                      ) : (
                        <Bird className="h-6 w-6 text-emerald-600 shrink-0" />
                      )}
                      <div>
                        <div className="text-base font-black leading-tight">
                          {target.name}
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          {target.code}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-emerald-700 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* STICKY FOOTER DI PALING BAWAH SIDEBAR (TIDAK IKUT SCROLL) */}
            <div className="border-t-2 border-slate-200 bg-slate-50 p-4">
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 py-4 text-base font-black text-rose-800 shadow-sm hover:bg-rose-100 active:scale-95"
              >
                <LogOut className="h-5 w-5" />
                <span>Keluar Akun (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
