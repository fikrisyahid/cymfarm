"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Menu,
  X,
  LogOut,
  MapPin,
  Check,
  QrCode,
  BarChart3,
  Settings,
  UserCheck,
  Cloud,
  RefreshCw,
  Box,
  Camera,
  Home,
  Calendar,
  LineChart,
} from "lucide-react";
import { localDb, getTodayDateStr } from "@/lib/offline-db";
import { useAuthSession } from "@/lib/use-session";
import { useFarmSync } from "@/hooks/useFarmSync";
import { useOperasionalDate } from "@/context/DateContext";
import { QrScannerModal } from "./QrScannerModal";
import { DedicatedDatePickerModal } from "./DedicatedDatePickerModal";
import { toast } from "sonner";

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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { isSyncing, triggerSync } = useFarmSync();
  const { selectedDate, setSelectedDate, isToday, goToToday } = useOperasionalDate();

  const containers = useLiveQuery(() => localDb.containers.toArray(), [], []);

  const handleScanSuccess = (code: string) => {
    setScannerOpen(false);
    const target = containers?.find(
      (c) => c.code.toLowerCase() === code.toLowerCase()
    );
    if (target) {
      if (onSelectContainerCode) {
        onSelectContainerCode(target.code);
      } else {
        router.push(`/lapangan?loc=${target.code}`);
      }
      toast.success(`🎯 Membuka ${target.name}!`);
    } else {
      toast.error(`Kode QR "${code}" tidak ditemukan pada daftar wadah.`);
    }
  };

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
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 shadow-xs backdrop-blur">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
          aria-label="Buka Menu"
        >
          <Menu className="h-6 w-6 stroke-[2.5]" />
        </button>

        {/* Date Picker di Tengah Header */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setDatePickerOpen(true)}
            className="flex items-center gap-2 rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 cursor-pointer hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition active:scale-98"
          >
            <Calendar className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
              {new Date(selectedDate).toLocaleDateString("id-ID", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            {isToday ? (
              <span className="rounded-md bg-emerald-700 dark:bg-emerald-600 px-2 py-0.5 text-[9px] font-black text-white uppercase tracking-wider shrink-0">
                Hari Ini
              </span>
            ) : (
              <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white uppercase tracking-wider shrink-0">
                Masa Lalu
              </span>
            )}
          </button>

          {!isToday && (
            <button
              onClick={goToToday}
              className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 active:scale-95 transition"
              title="Kembali ke Hari Ini"
            >
              Hari Ini
            </button>
          )}
        </div>

        {/* Right side action: Sync Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerSync()}
            disabled={isSyncing}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition disabled:opacity-50"
            title="Sinkronisasi Cloud Supabase"
          >
            {isSyncing ? (
              <RefreshCw className="h-5 w-5 animate-spin text-emerald-700 dark:text-emerald-400" />
            ) : (
              <Cloud className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            )}
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENT (STRETCH FOR TABLET & DESKTOP) */}
      <main className="p-4 sm:p-6 lg:p-8 pb-24 w-full max-w-7xl mx-auto">{children}</main>

      {/* 3. BOTTOM BAR 5-ITEM DENGAN SCAN QR CENTER FLOATING (SIMETRIS PRESISI 2-1-2) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t-2 border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-lg items-center px-2">
        {/* Item 1: Lapangan */}
        <div className="flex-1 flex justify-center">
          <Link
            href="/lapangan"
            className={`flex flex-col items-center justify-center py-1 transition ${
              pathname.startsWith("/lapangan")
                ? "text-emerald-700 dark:text-emerald-400 font-black"
                : "text-slate-500 dark:text-slate-400 font-bold hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Lapangan</span>
          </Link>
        </div>

        {/* Item 2: Analisa / Grafik Tren */}
        <div className="flex-1 flex justify-center">
          <Link
            href="/analisa"
            className={`flex flex-col items-center justify-center py-1 transition ${
              pathname.startsWith("/analisa")
                ? "text-emerald-700 dark:text-emerald-400 font-black"
                : "text-slate-500 dark:text-slate-400 font-bold hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <LineChart className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Analisa</span>
          </Link>
        </div>

        {/* Item 3 (Center): Floating Action Button (FAB) Scan QR */}
        <div className="relative -top-5 flex flex-col items-center shrink-0 px-2">
          <button
            onClick={() => setScannerOpen(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 dark:bg-emerald-600 text-white shadow-xl hover:bg-emerald-800 active:scale-95 transition border-4 border-white dark:border-slate-900"
            title="Scan QR Kandang Langsung"
            aria-label="Scan QR Kandang"
          >
            <Camera className="h-6 w-6 stroke-[2.5]" />
          </button>
          <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 mt-1">
            Scan QR
          </span>
        </div>

        {/* Item 4: Riwayat */}
        <div className="flex-1 flex justify-center">
          <Link
            href="/riwayat"
            className={`flex flex-col items-center justify-center py-1 transition ${
              pathname.startsWith("/riwayat")
                ? "text-emerald-700 dark:text-emerald-400 font-black"
                : "text-slate-500 dark:text-slate-400 font-bold hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Riwayat</span>
          </Link>
        </div>

        {/* Item 5: Setelan */}
        <div className="flex-1 flex justify-center">
          <Link
            href="/pengaturan"
            className={`flex flex-col items-center justify-center py-1 transition ${
              pathname.startsWith("/pengaturan")
                ? "text-emerald-700 dark:text-emerald-400 font-black"
                : "text-slate-500 dark:text-slate-400 font-bold hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Setelan</span>
          </Link>
        </div>
      </nav>

      {/* SCANNER MODAL DARI NAVBAR */}
      {scannerOpen && (
        <QrScannerModal
          onScanSuccess={handleScanSuccess}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* DEDICATED DATE PICKER MODAL */}
      {datePickerOpen && (
        <DedicatedDatePickerModal
          selectedDate={selectedDate}
          onSelectDate={(newDate) => {
            setSelectedDate(newDate);
          }}
          onClose={() => setDatePickerOpen(false)}
        />
      )}

      {/* 4. TOGGLE SIDEBAR AREA */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[85%] max-w-sm flex-col bg-white dark:bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700 shadow-sm overflow-hidden p-1">
                  <Image
                    src="/icon.svg"
                    alt="CymFarm"
                    width={36}
                    height={36}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <div className="text-base font-black text-slate-900 dark:text-slate-100">CymFarm</div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{session?.displayName || "Keluarga"}</div>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex items-center gap-2 px-4 pt-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <MapPin className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <span>Daftar Lokasi & Wadah</span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4 pr-3">
              {(!containers || containers.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center text-xs font-bold text-slate-400">
                  Belum ada wadah terdaftar
                </div>
              ) : (
                containers.map((target) => {
                  const isSelected = activeContainerCode === target.code;
                  return (
                    <button
                      key={target.id}
                      onClick={() => handleSelectLocation(target.code)}
                      className={`flex w-full items-center justify-between rounded-2xl border-2 p-3 text-left transition ${
                        isSelected
                          ? "border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200 font-black"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Box className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-sm font-black leading-tight">{target.name}</div>
                          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{target.code}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-2">
              {session?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-black transition ${
                    pathname.startsWith("/admin")
                      ? "border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200"
                      : "border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Settings className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Buka Admin Studio</span>
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 py-3 text-sm font-black text-rose-700 dark:text-rose-300 active:scale-95 transition"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
