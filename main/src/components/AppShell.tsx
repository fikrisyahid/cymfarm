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
} from "lucide-react";
import { localDb } from "@/lib/offline-db";
import { useAuthSession } from "@/lib/use-session";
import { useFarmSync } from "@/hooks/useFarmSync";
import { QrScannerModal } from "./QrScannerModal";
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
  const { isSyncing, triggerSync } = useFarmSync();

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
    <div className="relative min-h-screen bg-slate-50 text-slate-900">
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-slate-200 bg-white/95 px-4 shadow-xs backdrop-blur">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 transition"
          aria-label="Buka Menu"
        >
          <Menu className="h-6 w-6 stroke-[2.5]" />
        </button>

        <div className="text-center min-w-0">
          <div className="text-base font-black leading-tight text-slate-900 truncate">
            {pathname.startsWith("/lapangan")
              ? activeContainerCode ? `Area: ${activeContainerCode}` : "Halaman Lapangan"
              : pathname.startsWith("/riwayat")
              ? "Catatan & Riwayat"
              : "Admin Studio"}
          </div>
          <div className="text-[11px] font-bold text-slate-500">
            CymFarm Keluarga
          </div>
        </div>

        {/* Right side actions: Studio shortcut (if ADMIN) & Sync Button */}
        <div className="flex items-center gap-2">
          {session?.role === "ADMIN" && (
            <Link
              href="/admin"
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition active:scale-95 ${
                pathname.startsWith("/admin")
                  ? "border-emerald-700 bg-emerald-50 text-emerald-800 font-black shadow-xs"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Admin Studio"
              aria-label="Admin Studio"
            >
              <Settings className="h-5 w-5" />
            </Link>
          )}

          <button
            onClick={() => triggerSync()}
            disabled={isSyncing}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 transition disabled:opacity-50"
            title="Sinkronisasi Cloud Supabase"
          >
            {isSyncing ? (
              <RefreshCw className="h-5 w-5 animate-spin text-emerald-700" />
            ) : (
              <Cloud className="h-5 w-5 text-emerald-700" />
            )}
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENT (STRETCH FOR TABLET & DESKTOP) */}
      <main className="p-4 sm:p-6 lg:p-8 pb-24 w-full max-w-7xl mx-auto">{children}</main>

      {/* 3. BOTTOM BAR DENGAN SCAN QR CENTER FLOATING (SIMETRIS PRESISI) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t-2 border-slate-200 bg-white/95 backdrop-blur shadow-lg items-center px-4">
        {/* Left Side: Lapangan */}
        <div className="flex-1 flex justify-center">
          <Link
            href="/lapangan"
            className={`flex flex-col items-center justify-center py-1 transition ${
              pathname.startsWith("/lapangan")
                ? "text-emerald-700 font-black"
                : "text-slate-500 font-bold hover:text-slate-800"
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Lapangan</span>
          </Link>
        </div>

        {/* Center Floating Action Button (FAB) Scan QR */}
        <div className="relative -top-5 flex flex-col items-center shrink-0 px-4">
          <button
            onClick={() => setScannerOpen(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xl hover:bg-emerald-800 active:scale-95 transition border-4 border-white"
            title="Scan QR Kandang Langsung"
            aria-label="Scan QR Kandang"
          >
            <Camera className="h-6 w-6 stroke-[2.5]" />
          </button>
          <span className="text-[10px] font-black text-slate-800 mt-1">
            Scan QR
          </span>
        </div>

        {/* Right Side: Riwayat */}
        <div className="flex-1 flex justify-center">
          <Link
            href="/riwayat"
            className={`flex flex-col items-center justify-center py-1 transition ${
              pathname.startsWith("/riwayat")
                ? "text-emerald-700 font-black"
                : "text-slate-500 font-bold hover:text-slate-800"
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Riwayat</span>
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

      {/* 4. TOGGLE SIDEBAR AREA */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[85%] max-w-sm flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 p-4">
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
                  <div className="text-base font-black text-slate-900">CymFarm</div>
                  <div className="text-xs font-bold text-slate-500">{session?.displayName || "Keluarga"}</div>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex items-center gap-2 px-4 pt-4 text-xs font-black uppercase tracking-wider text-slate-500">
              <MapPin className="h-4 w-4 text-emerald-700" />
              <span>Daftar Lokasi & Wadah</span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4 pr-3">
              {(!containers || containers.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs font-bold text-slate-400">
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
                          ? "border-emerald-700 bg-emerald-50 text-emerald-950 font-black"
                          : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Box className="h-5 w-5 text-emerald-700 shrink-0" />
                        <div>
                          <div className="text-sm font-black leading-tight">{target.name}</div>
                          <div className="text-[11px] font-bold text-slate-500">{target.code}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-emerald-700" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-200 p-4 space-y-2">
              {session?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-black transition ${
                    pathname.startsWith("/admin")
                      ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                      : "border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <Settings className="h-4 w-4 text-emerald-700" />
                  <span>Buka Admin Studio</span>
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 py-3 text-sm font-black text-rose-700 active:scale-95 transition"
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
