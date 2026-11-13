"use client";

import React, { useState } from "react";
import {
  Wheat,
  Plus,
  Trash2,
  Edit2,
  X,
  Search,
  Filter,
  PackageCheck,
  Calendar,
  AlertCircle,
  FolderPlus,
} from "lucide-react";
import {
  localDb,
  DEFAULT_FEED_CATEGORIES,
  type LocalFeedCategory,
  type LocalFeedPurchase,
} from "@/lib/offline-db";
import type { FeedCategory } from "@/db/schema";
import { toast } from "sonner";

interface PakanManagementViewProps {
  feedPurchases: LocalFeedPurchase[];
  feedCategories?: LocalFeedCategory[];
}

export function PakanManagementView({
  feedPurchases,
  feedCategories = [],
}: PakanManagementViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [editingFeed, setEditingFeed] = useState<LocalFeedPurchase | null>(null);
  const [deleteConfirmFeed, setDeleteConfirmFeed] = useState<LocalFeedPurchase | null>(null);

  // Form states untuk Pakan
  const [feedName, setFeedName] = useState<string>("");
  const [category, setCategory] = useState<FeedCategory>("AYAM");
  const [weightKg, setWeightKg] = useState<number>(25);
  const [priceIdr, setPriceIdr] = useState<number>(215000);
  const [purchasedAt, setPurchasedAt] = useState<string>(
    () => new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState<string>("");

  // Form states untuk Buat Kategori Baru
  const [newCatName, setNewCatName] = useState<string>("");
  const [newCatIcon, setNewCatIcon] = useState<string>("🦆");

  // Gabungkan daftar kategori dari DB atau default
  const activeCategories = feedCategories.length > 0 ? feedCategories : DEFAULT_FEED_CATEGORIES;

  const categoriesTab: Array<{ id: string; label: string; icon: string }> = [
    { id: "ALL", label: "Semua Kategori", icon: "📦" },
    ...activeCategories.map((c) => ({
      id: c.id,
      label: c.name,
      icon: c.icon,
    })),
  ];

  const handleOpenAdd = () => {
    setEditingFeed(null);
    setFeedName("");
    setCategory(activeCategories[0]?.id || "AYAM");
    setWeightKg(25);
    setPriceIdr(215000);
    setPurchasedAt(new Date().toISOString().split("T")[0]);
    setNotes("");
    setShowModal(true);
  };

  const handleOpenEdit = (feed: LocalFeedPurchase) => {
    setEditingFeed(feed);
    setFeedName(feed.feedName);
    setCategory(feed.category || "AYAM");
    setWeightKg(feed.weightKg);
    setPriceIdr(feed.priceIdr || 0);
    setPurchasedAt(
      feed.purchasedAt ? feed.purchasedAt.split("T")[0] : new Date().toISOString().split("T")[0]
    );
    setNotes(feed.notes || "");
    setShowModal(true);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toast.error("Nama kategori pakan wajib diisi!");
      return;
    }

    const catId = `cat-${newCatName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-3)}`;
    const catObject: LocalFeedCategory = {
      id: catId,
      name: newCatName.trim(),
      icon: newCatIcon.trim() || "🌾",
    };

    await localDb.feedCategories.put(catObject);

    // Catat ke Activity Log
    await localDb.activityLogs.put({
      id: `log-cat-crt-${Date.now()}`,
      moduleId: "logistik",
      containerId: "gudang",
      activityType: "FEED_CATEGORY_CREATE",
      quantity: 1,
      note: `Tambah kategori pakan baru: ${catObject.icon} ${catObject.name}`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    toast.success(`Kategori "${catObject.name}" berhasil dibuat!`);
    setNewCatName("");
    setCategory(catId);
    setShowCategoryModal(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedName.trim()) {
      toast.error("Nama pakan / logistik wajib diisi!");
      return;
    }

    const isoDate = new Date(`${purchasedAt}T08:00:00`).toISOString();

    if (editingFeed) {
      // Update
      await localDb.feedPurchases.update(editingFeed.id, {
        feedName: feedName.trim(),
        category,
        weightKg: Number(weightKg),
        priceIdr: Number(priceIdr),
        purchasedAt: isoDate,
        notes: notes.trim(),
      });

      // Catat ke Activity Log
      await localDb.activityLogs.put({
        id: `log-feed-upd-${Date.now()}`,
        moduleId: "logistik",
        containerId: "gudang",
        activityType: "FEED_PURCHASE_UPDATE",
        quantity: Math.round(Number(weightKg)),
        note: `Perbarui data pakan: ${feedName.trim()} (${weightKg} KG, ${category})`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });

      toast.success(`Data ${feedName} berhasil diperbarui!`);
    } else {
      // Create
      const newId = `feed-${Date.now()}`;
      await localDb.feedPurchases.put({
        id: newId,
        feedName: feedName.trim(),
        category,
        weightKg: Number(weightKg),
        priceIdr: Number(priceIdr),
        purchasedAt: isoDate,
        notes: notes.trim(),
      });

      // Catat ke Activity Log
      await localDb.activityLogs.put({
        id: `log-feed-crt-${Date.now()}`,
        moduleId: "logistik",
        containerId: "gudang",
        activityType: "FEED_PURCHASE_CREATE",
        quantity: Math.round(Number(weightKg)),
        note: `Beli pakan baru: ${feedName.trim()} (${weightKg} KG, ${category})`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });

      toast.success(`Pakan ${feedName} berhasil ditambahkan!`);
    }

    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirmFeed) return;
    const feed = deleteConfirmFeed;

    await localDb.feedPurchases.delete(feed.id);

    // Catat ke Activity Log
    await localDb.activityLogs.put({
      id: `log-feed-del-${Date.now()}`,
      moduleId: "logistik",
      containerId: "gudang",
      activityType: "FEED_PURCHASE_DELETE",
      quantity: Math.round(feed.weightKg),
      note: `Hapus pakan: ${feed.feedName} (${feed.weightKg} KG)`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    toast.success(`Pakan ${feed.feedName} berhasil dihapus.`);
    setDeleteConfirmFeed(null);
  };

  // Filter & Search
  const filteredPurchases = feedPurchases
    .filter((f) => {
      if (selectedCategory !== "ALL") {
        const cat = f.category || "AYAM";
        if (cat !== selectedCategory) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = f.feedName.toLowerCase().includes(q);
        const matchNote = (f.notes || "").toLowerCase().includes(q);
        if (!matchName && !matchNote) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
    );

  // Summary Metrics
  const totalWeight = filteredPurchases.reduce((acc, curr) => acc + (Number(curr.weightKg) || 0), 0);
  const totalPrice = filteredPurchases.reduce((acc, curr) => acc + (Number(curr.priceIdr) || 0), 0);

  return (
    <div className="space-y-4 pb-20">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border-3 border-amber-300 bg-amber-50/70 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-500 p-3 text-slate-950">
            <Wheat className="h-7 w-7" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-900">
              LOGISTIK & INVENTARIS
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Manajemen Pakan Mandiri
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-amber-600 bg-amber-100/70 px-4 py-3.5 text-sm font-black text-amber-950 shadow-xs hover:bg-amber-200 active:scale-95"
          >
            <FolderPlus className="h-4 w-4" />
            <span>+ Kategori Baru</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3.5 text-base font-black text-slate-950 shadow-sm hover:bg-amber-400 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            <span>Tambah Pakan</span>
          </button>
        </div>
      </div>

      {/* RINGKASAN METRIK */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-black uppercase tracking-wider text-slate-500">
            Total Tercatat
          </div>
          <div className="text-2xl font-black text-slate-900">
            {filteredPurchases.length} <span className="text-sm font-bold text-slate-500">Item</span>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-black uppercase tracking-wider text-slate-500">
            Total Bobot
          </div>
          <div className="text-2xl font-black text-amber-700">
            {totalWeight.toFixed(1)} <span className="text-sm font-bold text-slate-500">KG</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-black uppercase tracking-wider text-slate-500">
            Total Anggaran
          </div>
          <div className="text-2xl font-black text-emerald-700">
            Rp {totalPrice.toLocaleString("id-ID")}
          </div>
        </div>
      </div>

      {/* HORIZONTAL TAB KATEGORI */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categoriesTab.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition active:scale-95 ${
                isSelected
                  ? "bg-amber-500 text-slate-950 shadow-sm border-2 border-amber-600"
                  : "bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* PENCARIAN */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama pakan, sak, atau catatan..."
          className="w-full rounded-2xl border-2 border-slate-300 bg-white py-3 pl-12 pr-4 text-base font-bold text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-3.5 rounded-lg p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* DAFTAR KARTU PAKAN (CRUD VIEW) */}
      <div className="space-y-3">
        {filteredPurchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
            <PackageCheck className="h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-lg font-black text-slate-800">
              Belum Ada Data Pakan
            </h3>
            <p className="mt-1 text-xs font-bold text-slate-500 max-w-xs">
              Belum ada logistik pakan di kategori ini. Klik tombol tambah di atas untuk mencatat pakan baru.
            </p>
          </div>
        ) : (
          filteredPurchases.map((feed) => {
            const feedCat = feed.category || "AYAM";
            const catBadge =
              feedCat === "AYAM"
                ? "bg-amber-100 text-amber-900 border-amber-300"
                : feedCat === "IKAN"
                ? "bg-sky-100 text-sky-900 border-sky-300"
                : feedCat === "TANAMAN"
                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                : "bg-slate-100 text-slate-800 border-slate-300";

            return (
              <div
                key={feed.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded-xl border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${catBadge}`}
                    >
                      {feedCat}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 truncate">
                      {feed.feedName}
                    </h3>
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-xs font-bold text-slate-600 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {new Date(feed.purchasedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="font-black text-amber-800">
                      {feed.weightKg} KG
                    </div>

                    {feed.priceIdr ? (
                      <div className="font-black text-emerald-700">
                        Rp {feed.priceIdr.toLocaleString("id-ID")}
                      </div>
                    ) : null}
                  </div>

                  {feed.notes && (
                    <p className="mt-2 text-xs font-medium text-slate-500 bg-slate-50 rounded-xl p-2 border border-slate-100">
                      📝 {feed.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <button
                    onClick={() => handleOpenEdit(feed)}
                    className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-800 hover:bg-slate-100 active:scale-95"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-amber-600" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => setDeleteConfirmFeed(feed)}
                    className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border-2 border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-black text-rose-800 hover:bg-rose-100 active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL FORM TAMBAH / EDIT PAKAN */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
            className="w-full max-w-md rounded-3xl border-3 border-amber-500 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  {editingFeed ? "EDIT LOGISTIK" : "INPUT LOGISTIK BARU"}
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  {editingFeed ? "Edit Data Pakan" : "Tambah Pakan / Nutrisi"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Nama Pakan / Bahan *
                </label>
                <input
                  type="text"
                  required
                  value={feedName}
                  onChange={(e) => setFeedName(e.target.value)}
                  placeholder="Misal: Pelet Lele LP-2 / Pakan Ayam Karung"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Kategori Pakan
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="text-xs font-black text-amber-800 hover:underline"
                  >
                    + Buat Kategori Baru
                  </button>
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedCategory)}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                >
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Berat (KG) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Harga Beli (Rp)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={priceIdr}
                    onChange={(e) => setPriceIdr(parseInt(e.target.value) || 0)}
                    className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Tanggal Pembelian
                </label>
                <input
                  type="date"
                  value={purchasedAt}
                  onChange={(e) => setPurchasedAt(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Catatan Tambahan
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Beli di toko langganan / stok gudang"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-base font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-amber-500 py-3 text-base font-black text-slate-950 active:scale-95 shadow-sm hover:bg-amber-400"
              >
                {editingFeed ? "Simpan Perubahan" : "Simpan Pakan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL BUAT KATEGORI PAKAN BARU */}
      {showCategoryModal && (
        <div
          onClick={() => setShowCategoryModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateCategory}
            className="w-full max-w-sm rounded-3xl border-3 border-amber-600 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  KATEGORI LOGISTIK
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  + Buat Kategori Pakan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Nama Kategori *
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Misal: Pakan Bebek / Maggot BSF"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Pilih Ikon Emoji
                </label>
                <div className="mt-1.5 flex gap-2 flex-wrap">
                  {["🦆", "🐛", "🐟", "🐔", "🐑", "🐄", "🥬", "🌽", "🌾", "💊"].map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setNewCatIcon(emoji)}
                      className={`h-11 w-11 rounded-xl text-xl flex items-center justify-center transition border-2 ${
                        newCatIcon === emoji
                          ? "border-amber-600 bg-amber-100 scale-105 shadow-xs"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-amber-500 py-3 text-sm font-black text-slate-950 active:scale-95 shadow-sm hover:bg-amber-400"
              >
                Simpan Kategori
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteConfirmFeed && (
        <div
          onClick={() => setDeleteConfirmFeed(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border-3 border-rose-500 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center gap-3 text-rose-700">
              <AlertCircle className="h-8 w-8 shrink-0" />
              <h3 className="text-xl font-black text-slate-900">
                Hapus Pakan Ini?
              </h3>
            </div>

            <p className="mt-3 text-sm font-bold text-slate-600">
              Apakah Anda yakin ingin menghapus catatan pakan{" "}
              <strong className="text-slate-900">
                {deleteConfirmFeed.feedName} ({deleteConfirmFeed.weightKg} KG)
              </strong>
              ? Data ini akan dihapus dari inventaris.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeleteConfirmFeed(null)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-2xl bg-rose-700 py-3 text-sm font-black text-white active:scale-95 hover:bg-rose-800"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
