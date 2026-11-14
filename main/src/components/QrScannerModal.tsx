"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, AlertCircle, Upload, SwitchCamera, RefreshCw } from "lucide-react";

interface QrScannerModalProps {
  onScanSuccess: (code: string) => void;
  onClose: () => void;
}

interface CameraDevice {
  id: string;
  label: string;
}

export function QrScannerModal({ onScanSuccess, onClose }: QrScannerModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isStoppingRef = useRef(false);

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
    stopScanner().then(() => {
      onScanSuccess(code);
    });
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && isScanning && !isStoppingRef.current) {
      isStoppingRef.current = true;
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn("[QR Scanner] Error stopping scanner:", err);
      } finally {
        isStoppingRef.current = false;
        setIsScanning(false);
      }
    }
  };

  const startScanningWithCamera = async (cameraId: string) => {
    if (!html5QrCodeRef.current) {
      html5QrCodeRef.current = new Html5Qrcode("cymfarm-qr-viewport");
    }

    try {
      setIsStarting(true);
      setErrorMessage(null);

      // Stop previous scanning instance if active
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      await html5QrCodeRef.current.start(
        cameraId,
        {
          fps: 15,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleProcessQrText(decodedText);
        },
        () => {
          // Frame error ignored
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("[QR Scanner] Start error:", err);
      setErrorMessage(
        err?.message || "Gagal membuka kamera. Pastikan izin kamera aktif dan kamera tidak dipakai aplikasi lain."
      );
      setIsScanning(false);
    } finally {
      setIsStarting(false);
    }
  };

  // Inisialisasi daftar kamera perangkat
  useEffect(() => {
    let mounted = true;

    async function initCameras() {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (!devices || devices.length === 0) {
          setErrorMessage("Tidak ada kamera yang ditemukan di perangkat ini.");
          return;
        }

        const formatted = devices.map((d, index) => ({
          id: d.id,
          label: d.label || `Kamera ${index + 1}`,
        }));

        setCameras(formatted);

        // Pilih kamera belakang (environment/back) sebagai default jika ada
        const backCamera = formatted.find(
          (c) =>
            c.label.toLowerCase().includes("back") ||
            c.label.toLowerCase().includes("belakang") ||
            c.label.toLowerCase().includes("environment") ||
            c.label.toLowerCase().includes("rear")
        );

        const chosenCamera = backCamera || formatted[formatted.length - 1];
        setSelectedCameraId(chosenCamera.id);

        // Mulai scan
        startScanningWithCamera(chosenCamera.id);
      } catch (err: any) {
        if (!mounted) return;
        console.error("[QR Scanner] Camera enum error:", err);
        setErrorMessage(
          err?.message || "Izin kamera ditolak atau kamera tidak dapat diakses."
        );
      }
    }

    initCameras();

    return () => {
      mounted = false;
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(() => {}).finally(() => {
            html5QrCodeRef.current?.clear();
          });
        } else {
          html5QrCodeRef.current.clear();
        }
      }
    };
  }, []);

  // Saat dropdown kamera berubah
  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCameraId = e.target.value;
    setSelectedCameraId(newCameraId);
    if (newCameraId) {
      startScanningWithCamera(newCameraId);
    }
  };

  // Upload/pilih gambar file QR (Bekerja 100% tanpa video stream)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode("cymfarm-file-reader-hidden");
      const decodedText = await html5QrCode.scanFile(file, true);
      handleProcessQrText(decodedText);
    } catch {
      setErrorMessage("Tidak dapat membaca QR code dari gambar ini. Pastikan gambar jelas.");
    }
  };

  return (
    <div
      onClick={() => {
        stopScanner().finally(onClose);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border-2 border-emerald-600 bg-white p-5 shadow-2xl space-y-3.5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-emerald-700" />
            <h3 className="text-base font-black text-slate-900">Scan QR Kandang</h3>
          </div>
          <button
            onClick={() => stopScanner().finally(onClose)}
            className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dropdown Pemilihan Kamera di Luar Box Kamera */}
        {cameras.length > 0 && (
          <div className="space-y-1">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <SwitchCamera className="h-3.5 w-3.5 text-emerald-700" />
              Pilih Kamera:
            </label>
            <div className="relative">
              <select
                value={selectedCameraId}
                onChange={handleCameraChange}
                disabled={isStarting}
                className="w-full appearance-none rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none transition disabled:opacity-50"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                ▼
              </div>
            </div>
          </div>
        )}

        {/* Box Kamera Viewport */}
        {errorMessage ? (
          <div className="rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50 p-4 text-center text-rose-800 space-y-2">
            <AlertCircle className="mx-auto h-7 w-7 text-rose-600" />
            <p className="text-xs font-black">{errorMessage}</p>
            <button
              onClick={() => selectedCameraId && startScanningWithCamera(selectedCameraId)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Coba Lagi
            </button>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-950 aspect-square flex items-center justify-center">
            {isStarting && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 text-white gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
                <p className="text-xs font-bold">Menghubungkan kamera...</p>
              </div>
            )}
            <div
              id="cymfarm-qr-viewport"
              className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
            />
          </div>
        )}

        <p className="text-[11px] font-bold text-slate-400 text-center">
          Posisikan barcode QR tepat di dalam kotak kamera.
        </p>

        {/* Hidden File Scanner Container for html5-qrcode */}
        <div id="cymfarm-file-reader-hidden" className="hidden" />

        {/* Alternatif Upload Gambar QR */}
        <div>
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
            <span>Unggah Foto / Screenshot QR</span>
          </button>
        </div>

        <button
          onClick={() => stopScanner().finally(onClose)}
          className="w-full rounded-2xl border-2 border-slate-300 bg-slate-100 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition"
        >
          Tutup Scanner
        </button>
      </div>
    </div>
  );
}
