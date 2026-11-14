"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Check } from "lucide-react";
import { getTodayDateStr } from "@/lib/offline-db";

interface DedicatedDatePickerModalProps {
  selectedDate: string; // 'YYYY-MM-DD'
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function DedicatedDatePickerModal({
  selectedDate,
  onSelectDate,
  onClose,
}: DedicatedDatePickerModalProps) {
  const todayStr = getTodayDateStr();

  // Parse tanggal terpilih atau fallback ke today
  const initialDate = selectedDate ? new Date(selectedDate) : new Date(todayStr);
  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth()); // 0 - 11

  const todayObj = new Date(todayStr);
  const isCurrentMonthTodayMonth =
    currentYear === todayObj.getFullYear() && currentMonth === todayObj.getMonth();

  // Navigasi bulan
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    // Tidak boleh maju ke bulan di masa depan jika bulan ini sudah bulan berjalan
    if (isCurrentMonthTodayMonth) return;

    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Hitung grid kalender
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Minggu
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarDays: Array<{
    dayNumber: number;
    dateStr: string;
    isFuture: boolean;
    isToday: boolean;
    isSelected: boolean;
  }> = [];

  for (let i = 1; i <= daysInMonth; i++) {
    const monthStr = String(currentMonth + 1).padStart(2, "0");
    const dayStr = String(i).padStart(2, "0");
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;

    calendarDays.push({
      dayNumber: i,
      dateStr,
      isFuture,
      isToday,
      isSelected,
    });
  }

  const handleSelect = (dateStr: string, isFuture: boolean) => {
    if (isFuture) return; // Strict: Tidak bisa diklik jika masa depan
    onSelectDate(dateStr);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border-2 border-emerald-600 dark:border-emerald-500 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              Pilih Tanggal Operasional
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-800 p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Bulan & Tahun Navigator */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
            title="Bulan Sebelumnya"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
          </button>

          <div className="text-center font-black text-slate-900 dark:text-slate-100 text-sm">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={isCurrentMonthTodayMonth}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 active:scale-95 transition"
            title="Bulan Berikutnya"
          >
            <ChevronRight className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Grid Hari Kalender */}
        <div className="space-y-1">
          {/* Header Nama Hari */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 py-1">
            {DAY_LABELS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Grid Tanggal */}
          <div className="grid grid-cols-7 gap-1">
            {/* Offset hari pertama */}
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className="h-10" />
            ))}

            {/* Tanggal dalam bulan */}
            {calendarDays.map((item) => (
              <button
                key={item.dateStr}
                type="button"
                disabled={item.isFuture}
                onClick={() => handleSelect(item.dateStr, item.isFuture)}
                className={`relative flex h-10 w-full items-center justify-center rounded-xl text-xs font-black transition active:scale-95 ${
                  item.isFuture
                    ? "cursor-not-allowed opacity-25 text-slate-400 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-950/20"
                    : item.isSelected
                    ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400"
                    : item.isToday
                    ? "border-2 border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200"
                    : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{item.dayNumber}</span>
                {item.isToday && !item.isSelected && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions (Hari Ini & Kemarin) */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectDate(todayStr);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-black text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 active:scale-95 transition"
          >
            Hari Ini
          </button>

          <button
            type="button"
            onClick={() => {
              const d = new Date(todayStr);
              d.setDate(d.getDate() - 1);
              const yesterdayStr = d.toISOString().split("T")[0];
              onSelectDate(yesterdayStr);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-black text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
          >
            Kemarin
          </button>
        </div>
      </div>
    </div>
  );
}
