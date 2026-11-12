"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { QrCode, BarChart3, Settings, LogOut, UserCheck } from "lucide-react";
import { useAuthSession } from "@/lib/use-session";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuthSession();

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("cymfarm_user_session");
    }
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-slate-300 bg-white shadow-sm">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* App Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-black text-white shadow">
              CF
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                CymFarm Keluarga
              </h1>
              {session && (
                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                  <UserCheck className="h-4 w-4 text-emerald-700" />
                  <span>
                    Akun: <strong>{session.displayName}</strong> ({session.role})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-2xl border-2 border-rose-300 bg-rose-50 px-5 py-3 text-base font-extrabold text-rose-800 hover:bg-rose-100 active:scale-95"
          >
            <LogOut className="h-5 w-5" />
            Keluar
          </button>
        </div>

        {/* Big Navigation Bar (Universal Terminology for any Livestock/Plant/Aquaculture) */}
        <nav className="mt-4 grid grid-cols-2 gap-3 sm:flex">
          <Link
            href="/lapangan"
            className={`flex flex-1 items-center justify-center gap-3 rounded-2xl border-2 px-5 py-4 text-lg font-black transition ${
              pathname.startsWith("/lapangan")
                ? "border-emerald-800 bg-emerald-700 text-white shadow-md"
                : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
          >
            <QrCode className="h-7 w-7 shrink-0" />
            <span>Area & Lapangan</span>
          </Link>

          <Link
            href="/analisa"
            className={`flex flex-1 items-center justify-center gap-3 rounded-2xl border-2 px-5 py-4 text-lg font-black transition ${
              pathname.startsWith("/analisa")
                ? "border-emerald-800 bg-emerald-700 text-white shadow-md"
                : "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
          >
            <BarChart3 className="h-7 w-7 shrink-0" />
            <span>Analisa & Logistik</span>
          </Link>

          {session?.role === "ADMIN" && (
            <Link
              href="/admin"
              className={`col-span-2 flex flex-1 items-center justify-center gap-3 rounded-2xl border-2 px-5 py-4 text-lg font-black transition sm:col-span-1 ${
                pathname.startsWith("/admin")
                  ? "border-sky-800 bg-sky-700 text-white shadow-md"
                  : "border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100"
              }`}
            >
              <Settings className="h-7 w-7 shrink-0" />
              <span>Admin & Modul</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
