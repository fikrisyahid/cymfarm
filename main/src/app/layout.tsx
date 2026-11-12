import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "CymFarm Keluarga",
  description:
    "Aplikasi Manajemen Peternakan Keluarga (Ayam, Lele, & Modul Dinamis)",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
