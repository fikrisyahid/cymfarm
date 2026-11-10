import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CymFarm — Dynamic Family Farm Management",
  description:
    "Modular family farm management PWA with 7 Lego Block Flow Builder, QR Cage Scanning, Lele 3-Day Fasting Timer, and Offline-First Dexie + Supabase Drizzle.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
