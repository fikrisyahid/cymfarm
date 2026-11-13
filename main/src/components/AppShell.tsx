"use client";

import React, { useState, useEffect } from "react";
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
  Calendar,
} from "lucide-react";
import { localDb } from "@/lib/offline-db";
import { useAuthSession } from "@/lib/use-session";

interface AppShellProps {
  children: React.ReactNode;
  activeContainerCode?: string;
  onSelectContainerCode?: (code: string) => void;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

export function AppShell({
  children,
  activeContainerCode,
  onSelectContainerCode,
  selectedDate,
  onSelectDate,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuthSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Kunci scroll halaman belakang (Body Scroll Lock) saat sidebar atau datepicker terbuka
  useEffect(() => {
    if (sidebarOpen || datePickerOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [sidebarOpen, datePickerOpen]);

  // Tanggal yang sedang aktif (default hari ini YYYY-MM-DD)
  const activeDateObj = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();

  // Format hari dan tanggal lengkap bahasa Indonesia (tanpa singkatan)
  const displayFormattedDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(activeDateObj);

  const todayStr = new Date().toISOString().split("T")[0];
  const isPastDate = selectedDate && selectedDate !== todayStr;

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
      {/* 1. TOP BAR: Icon Menu (Kiri), Info Hari/Tanggal & Lokasi (Tengah) */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-800 shadow-sm active:scale-95"
          aria-label="Buka Menu & Lokasi"
        >
          <Menu className="h-7 w-7" />
        </button>

        <div className="text-center">
          {/* Hari dan Tanggal Lengkap (Bisa diklik untuk buka popup date picker) */}
          <button
            onClick={() => onSelectDate && setDatePickerOpen(true)}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-black transition ${
              isPastDate
                ? "bg-amber-100 text-amber-950 border border-amber-300"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Calendar className={`h-3.5 w-3.5 ${isPastDate ? "text-amber-700" : "text-emerald-700"}`} />
            <span>{displayFormattedDate}</span>
            {isPastDate && <span className="text-[10px] bg-amber-200 px-1.5 rounded-md">Mode Revisi</span>}
          </button>
          {/* Judul Halaman / Lokasi Saat Ini */}
          <div className="text-lg font-black leading-tight text-slate-900 mt-0.5">
            {pathname.startsWith("/lapangan")
              ? activeContainerCode || "Area Kandang"
              : pathname.startsWith("/analisa")
                ? "Analisa & Pakan"
                : "Admin & Modul"}
          </div>
        </div>

        {/* Dummy spacer to balance hamburger icon */}
        <div className="h-12 w-12" />
      </div>

      {/* 2. MAIN CONTENT */}
      <main className="pb-20">{children}</main>

      {/* 3. BOTTOM NAVBAR (Paten & Selalu Kelihatan) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t-2 border-slate-200 bg-white/95 shadow-lg backdrop-blur">
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

      {/* 4. TOGGLEABLE SIDEBAR (z-50 Menutup Penuh Di Atas Navbar) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 transition-opacity backdrop-blur-sm touch-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[85%] max-w-sm flex-col bg-white shadow-2xl touch-auto"
          >
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

            <div className="flex items-center gap-2 px-4 pt-4 text-xs font-black uppercase tracking-wider text-slate-500">
              <MapPin className="h-4 w-4 text-emerald-700" />
              <span>Daftar Seluruh Lokasi / Area</span>
            </div>

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
      {/* 5. POPUP FULL LAYAR DATE PICKER DIMMED */}
      {datePickerOpen && (
        <div
          onClick={() => setDatePickerOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-700" />
                <h3 className="text-lg font-black text-slate-900">
                  Pilih Tanggal / Mundur Hari
                </h3>
              </div>
              <button
                onClick={() => setDatePickerOpen(false)}
                className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 text-xs font-bold text-slate-500">
              Pilih tanggal sebelumnya untuk memeriksa atau merevisi data pemberian pakan dan panen telur pada hari tersebut.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Pilih Tanggal:
              </label>
              <input
                type="date"
                value={selectedDate || todayStr}
                max={todayStr}
                onChange={(e) => {
                  if (onSelectDate) onSelectDate(e.target.value);
                  setDatePickerOpen(false);
                }}
                className="mt-1.5 w-full rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-lg font-black text-slate-900 focus:border-emerald-700 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  if (onSelectDate) onSelectDate(todayStr);
                  setDatePickerOpen(false);
                }}
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white hover:bg-emerald-800 active:scale-95"
              >
                Kembali ke Hari Ini
              </button>
              <button
                onClick={() => setDatePickerOpen(false)}
                className="rounded-2xl border-2 border-slate-300 bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200 active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
