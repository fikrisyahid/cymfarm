"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera, X, AlertCircle } from "lucide-react";

interface QrScannerModalProps {
  onScanSuccess: (code: string) => void;
  onClose: () => void;
}

export function QrScannerModal({ onScanSuccess, onClose }: QrScannerModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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
        (decodedText) => {
          // Parse format: cymfarm://container/KANDANG-A1 or plain KANDANG-A1 or url
          let code = decodedText.trim();
          if (code.startsWith("cymfarm://container/")) {
            code = code.replace("cymfarm://container/", "");
          } else if (code.includes("loc=")) {
            const url = new URL(code, "https://cymfarm.local");
            code = url.searchParams.get("loc") || code;
          }

          // Cleanup scanner before callback
          scanner.clear().catch(console.error);
          onScanSuccess(code);
        },
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
  }, [onScanSuccess]);

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
          <div className="rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50 p-6 text-center text-rose-800 space-y-2">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
            <p className="text-xs font-black">{errorMessage}</p>
            <p className="text-[11px] font-bold text-slate-500">
              Pastikan Anda telah mengizinkan izin kamera di browser Anda.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-slate-950">
            <div id="cymfarm-qr-reader" className="w-full" />
          </div>
        )}

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
