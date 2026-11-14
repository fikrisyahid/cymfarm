import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { DateProvider } from "@/context/DateContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "CymFarm Keluarga",
  description:
    "Aplikasi Manajemen Peternakan & Pertanian Keluarga (Ayam, Lele, Kambing, Jamur, & Tanaman)",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
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
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem('cymfarm_theme');
                if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
        <DateProvider>
          {children}
          <PwaInstallPrompt />
          <Toaster />
        </DateProvider>
      </body>
    </html>
  );
}
