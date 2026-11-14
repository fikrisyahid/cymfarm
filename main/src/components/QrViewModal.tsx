"use client";

import React, { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { type LocalContainer, type LocalFarmModule } from "@/lib/offline-db";
import { Download, Printer, X, QrCode } from "lucide-react";

interface QrViewModalProps {
  container: LocalContainer;
  module?: LocalFarmModule;
  onClose: () => void;
}

export function QrViewModal({ container, module, onClose }: QrViewModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  // Download SVG / PNG
  const handleDownload = () => {
    const svgElement = qrRef.current?.querySelector("svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    // Canvas size with padding & label
    canvas.width = 600;
    canvas.height = 700;

    img.onload = () => {
      if (!ctx) return;
      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Title header
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(container.name, 300, 50);

      ctx.fillStyle = "#059669";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(module?.name || "CymFarm Modular", 300, 85);

      // Draw QR in center
      ctx.drawImage(img, 100, 110, 400, 400);

      // Code text & info footer
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 32px monospace";
      ctx.fillText(container.code, 300, 560);

      ctx.fillStyle = "#64748b";
      ctx.font = "16px sans-serif";
      ctx.fillText("Scan dengan kamera CymFarm untuk langsung buka kandang", 300, 600);

      // Trigger download
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `QR-${container.code}-${container.name.replace(/\s+/g, "_")}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Print single QR
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs print:p-0 print:bg-white"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border-2 border-emerald-600 dark:border-emerald-500 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 print:border-none print:shadow-none print:max-w-none"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">QR Code Kandang / Wadah</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-800 p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Card */}
        <div
          ref={qrRef}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-6 text-center print:border-2 print:border-slate-800 print:bg-white"
        >
          <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-black uppercase text-emerald-950 dark:text-emerald-300">
            {module?.name || "CymFarm"}
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {container.name}
          </h2>

          <div className="my-4 rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
            <QRCodeSVG
              value={`cymfarm://container/${container.code}`}
              size={200}
              level="H"
              includeMargin={false}
            />
          </div>

          <div className="text-base font-black tracking-widest text-slate-800 dark:text-slate-200 font-mono">
            {container.code}
          </div>
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1 max-w-[220px]">
            Scan menggunakan aplikasi CymFarm untuk aksi cepat rawat & panen.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1 print:hidden">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-700 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 py-3 text-xs font-black text-emerald-950 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-950/80 active:scale-95 transition"
          >
            <Download className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <span>Unduh PNG</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-800 py-3 text-xs font-black text-white hover:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 transition border border-transparent dark:border-slate-700"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak (Print)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
