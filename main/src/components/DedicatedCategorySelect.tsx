"use client";

import React, { useState } from "react";
import { ChevronDown, Check, Plus, FolderPlus, X } from "lucide-react";
import type { LocalFarmModuleCategory } from "@/lib/offline-db";

interface DedicatedCategorySelectProps {
  categories: LocalFarmModuleCategory[];
  value: string;
  onChange: (categoryId: string) => void;
  onOpenCreateNew?: () => void;
}

export function DedicatedCategorySelect({
  categories,
  value,
  onChange,
  onOpenCreateNew,
}: DedicatedCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedCat = categories.find((c) => c.id === value);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Button yang mirip input form */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-1 w-full flex items-center justify-between rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-left text-sm font-bold text-slate-900 dark:text-slate-100 hover:border-emerald-600 focus:border-emerald-600 focus:outline-none transition active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-lg leading-none">{selectedCat?.icon || "📦"}</span>
          <span className="truncate">{selectedCat?.name || "Pilih Kategori"}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
      </button>

      {/* Dedicated Modal / Bottom Sheet Popup */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-3xl border-2 border-emerald-600 dark:border-emerald-500 bg-white dark:bg-slate-900 p-5 shadow-2xl overflow-hidden"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  <FolderPlus className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                    Pilih Kategori Modul
                  </h4>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Tentukan rumpun komoditas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* List Kategori */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
              {categories.map((cat) => {
                const isSelected = cat.id === value;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition text-left ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 font-black text-emerald-950 dark:text-emerald-200"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl leading-none">{cat.icon}</span>
                      <div>
                        <div className="text-sm font-black">{cat.name}</div>
                        {isSelected && (
                          <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            Sedang Dipilih
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer: Tombol Tambah Kategori Baru */}
            {onOpenCreateNew && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenCreateNew();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5 text-xs font-black text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Buat Kategori Baru</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
