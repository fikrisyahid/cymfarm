"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, User, Lock, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal masuk. Periksa nama & kata sandi.");
        setLoading(false);
        return;
      }

      if (typeof window !== "undefined" && data.user) {
        window.localStorage.setItem(
          "cymfarm_user_session",
          JSON.stringify(data.user)
        );
      }

      router.push("/lapangan");
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg rounded-3xl border-2 border-slate-300 bg-white p-8 shadow-xl">
        {/* Logo & Title */}
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-700 text-3xl font-black text-white shadow-md">
            CF
          </div>
          <h1 className="mt-4 text-3xl font-black text-slate-900">
            CymFarm Keluarga
          </h1>
          <p className="mt-2 text-lg font-semibold text-slate-600">
            Silakan masuk untuk mengelola kandang ayam & kolam lele
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-rose-500 bg-rose-50 p-4 text-lg font-bold text-rose-900">
            <AlertCircle className="h-7 w-7 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-lg font-extrabold text-slate-900">
              Nama Pengguna
            </label>
            <div className="relative mt-2">
              <User className="absolute left-4 top-4 h-7 w-7 text-slate-500" />
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ketik nama pengguna..."
                className="w-full rounded-2xl border-2 border-slate-400 bg-white py-4 pl-14 pr-4 text-xl font-bold text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-lg font-extrabold text-slate-900">
              Kata Sandi
            </label>
            <div className="relative mt-2">
              <Lock className="absolute left-4 top-4 h-7 w-7 text-slate-500" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ketik kata sandi..."
                className="w-full rounded-2xl border-2 border-slate-400 bg-white py-4 pl-14 pr-4 text-xl font-bold text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 py-5 text-2xl font-black text-white shadow-lg transition hover:bg-emerald-800 active:scale-98 disabled:opacity-60"
          >
            <LogIn className="h-8 w-8" />
            {loading ? "Sedang Masuk..." : "MASUK APLIKASI"}
          </button>
        </form>
      </div>
    </div>
  );
}
