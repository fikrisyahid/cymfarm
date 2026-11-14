# CymFarm — Truly Modular Family Farm Management PWA

Aplikasi manajemen peternakan & pertanian keluarga skala mikro/UMKM yang **modular, simpel, dan offline-first** (Next.js 15 App Router + Tailwind CSS + Dexie.js IndexedDB + Drizzle ORM + Supabase PostgreSQL).

Dirancang untuk kemudahan penggunaan oleh seluruh anggota keluarga (termasuk orang tua & anak-anak) di lapangan, dengan fleksibilitas penuh bagi Admin untuk menambah, mengubah, dan menghapus sistem ternak tanpa perlu koding ulang alur.

---

## 📚 Dokumentasi Lengkap
- 📐 **[Arsitektur Sistem & Data Flow (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)**: Penjelasan lengkap offline-first Dexie.js, skema database, LWW conflict resolution, anti-zombie pruning, dan PWA Service Worker.
- 🔄 **[Alur Penggunaan & Fitur Operasional (`docs/USE_CASE.md`)](./docs/USE_CASE.md)**: Use case diagram, alur QR scan, manajemen populasi, pembatalan aksi (Undo), dan perakitan sistem modular.
- 🛠️ **[Panduan Kontribusi & Operasional Root Wrapper (`docs/CONTRIBUTION.md`)](./docs/CONTRIBUTION.md)**: Standar operasional monorepo, instalasi package dari root, manajemen env, dan migrasi Drizzle.

---

## 🌟 3 Pilar Utama Aplikasi

1. **Sistem Farm Modular Tanpa Koding Ulang**:
   - Menambah komoditas ternak atau tanaman baru (Ayam Petelur, Lele, Kambing, Jamur Tiram, Tanaman Sayur, dll.) cukup lewat formulir **Admin Studio** 4-kotak sederhana.
   - Mengatur label tombol perawatan harian, satuan panen (butir/kg/ikat), serta ambang batas (*threshold alert*) panen per jenis ternak.
2. **Antarmuka Lapangan Super Sederhana (2 Tombol Raksasa)**:
   - Tampilan bersih untuk pekerja dan keluarga di kandang: **Tombol Rawat Harian** (hijau) & **Tombol Panen Hasil** (kuning).
   - Menghitung frekuensi aksi harian (*"Sudah 2x hari ini • Terakhir: 11:30 WIB"*) dan membolehkan pemberian pakan/panen berkali-kali dalam sehari.
   - Peringatan visual otomatis (*pulsing highlight*) hanya jika melewati ambang batas hari panen.
3. **Offline-First PWA Kebal Lapangan**:
   - Bekerja 100% tanpa internet di tengah kebun/kandang menggunakan IndexedDB.
   - Sinkronisasi dua arah instan ke Supabase PostgreSQL saat perangkat kembali terhubung ke jaringan internet.
   - PWA Service Worker menyimpan shell aplikasi dan aset secara permanen di HP.

---

## ⚡ Quick Start (Selalu Jalankan dari Direktori Root)

Proyek ini menggunakan **Bun** sebagai runtime dan package manager. Semua perintah dijalankan dari root repository:

```bash
# 1. Kloning repository
git clone https://github.com/username/cymfarm.git
cd cymfarm

# 2. Salin template environment & isi kredensial Supabase
cp .env.example .env

# 3. Install seluruh dependencies
bun install

# 4. Jalankan migrasi database ke Supabase
bun run db:migrate

# 5. Jalankan development server (otomatis sinkronkan /.env ke /main)
bun run dev
```

Buka browser di `http://localhost:3000` (atau via IP LAN di HP: `http://<IP_KOMPUTER>:3000`).

---

## 📱 Fitur Utama Aplikasi

- **Kamera Scan QR Cepat**: Tombol floating action button (FAB) di tengah navbar bawah untuk scan stiker QR fisik di kandang dan langsung melompat ke lokasi kandang tujuan.
- **Unduh & Cetak QR Code**: Admin bisa mengunduh file PNG beresolusi tinggi atau mencetak stiker QR wadah langsung dari browser.
- **Buka Semua Kandang (Grid Selector Warna)**: Pilihan kandang dengan indikator status harian (🟢 Hijau = Sudah Dirawat, 🟡 Kuning = Belum Dirawat).
- **Fitur Undo Instan**: Pembatalan aksi salah pencet langsung dari tombol toast notifikasi (6 detik) maupun dari halaman riwayat aktivitas.
- **Kelola Populasi di Lapangan**: Penambahan bibit baru, mutasi, atau pengurangan/pemotongan ternak langsung tercatat ke histori audit log.
- **PWA Auto-Install Prompt**: Dialog penawaran pasang aplikasi ke layar utama HP dengan jeda tunda (*24-hour snooze*) jika ditutup.
