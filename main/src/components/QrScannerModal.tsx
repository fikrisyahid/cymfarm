"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { Camera, X, AlertCircle, Upload, Check } from "lucide-react";

interface QrScannerModalProps {
  onScanSuccess: (code: string) => void;
  onClose: () => void;
}

export function QrScannerModal({ onScanSuccess, onClose }: QrScannerModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessQrText = (decodedText: string) => {
    let code = decodedText.trim();
    if (code.startsWith("cymfarm://container/")) {
      code = code.replace("cymfarm://container/", "");
    } else if (code.includes("loc=")) {
      try {
        const url = new URL(code, "https://cymfarm.local");
        code = url.searchParams.get("loc") || code;
      } catch {
        // use code directly
      }
    }
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
    }
    onScanSuccess(code);
  };

  // Upload/pilih gambar file QR (Bekerja 100% tanpa https / kamera)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode("cymfarm-file-reader-hidden");
      const decodedText = await html5QrCode.scanFile(file, true);
      handleProcessQrText(decodedText);
    } catch (err: any) {
      setErrorMessage("Tidak dapat membaca QR code dari gambar ini. Pastikan gambar jelas.");
    }
  };

  useEffect(() => {
    const scannerId = "cymfarm-qr-reader";

    try {
      const scanner = new Html5QrcodeScanner(
        scannerId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => handleProcessQrText(decodedText),
        (error) => {
          // ignore minor scan errors
        }
      );

      scannerRef.current = scanner;
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengakses kamera perangkat.");
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border-2 border-emerald-600 bg-white p-5 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-emerald-700" />
            <h3 className="text-base font-black text-slate-900">Scan QR Kandang</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs font-bold text-slate-500 text-center">
          Arahkan kamera ke stiker QR yang tertempel di depan kandang / wadah.
        </p>

        {errorMessage ? (
          <div className="rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50 p-4 text-center text-rose-800 space-y-2">
            <AlertCircle className="mx-auto h-7 w-7 text-rose-600" />
            <p className="text-xs font-black">{errorMessage}</p>
            <p className="text-[11px] font-bold text-slate-500">
              Browser mewajibkan HTTPS atau Localhost untuk membuka kamera langsung.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-slate-950">
            <div id="cymfarm-qr-reader" className="w-full" />
          </div>
        )}

        {/* Hidden File Scanner Container for html5-qrcode */}
        <div id="cymfarm-file-reader-hidden" className="hidden" />

        {/* Alternatif Upload Gambar QR (Bisa di HTTP non-localhost) */}
        <div className="pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-600 bg-emerald-50 py-2.5 text-xs font-black text-emerald-950 hover:bg-emerald-100 active:scale-95 transition"
          >
            <Upload className="h-4 w-4 text-emerald-700" />
            <span>Pilih File Gambar / Screenshot QR</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-xs font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition"
        >
          Tutup Scanner
        </button>
      </div>
    </div>
  );
}
