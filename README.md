# CymFarm — Modular Family Farm Management PWA

Aplikasi manajemen peternakan & pertanian keluarga skala mikro/UMKM yang **modular, simpel, dan offline-first** (Next.js 15 App Router + Tailwind CSS + Dexie.js IndexedDB + Drizzle ORM + Supabase PostgreSQL).

Dirancang untuk kemudahan penggunaan di lapangan oleh seluruh anggota keluarga (orang tua & anak-anak) dengan UI **2 tombol besar** (Rawat & Panen), scanner QR kandang, serta **Admin Studio** untuk membuat komoditas ternak baru tanpa koding ulang alur.

---

## 🌟 Fitur Utama

- **Offline-First (PWA)**: Beroperasi 100% tanpa internet di kandang menggunakan IndexedDB. Begitu terkoneksi internet, sinkronisasi dua arah otomatis berjalan ke Supabase PostgreSQL.
- **Sistem Modular Tanpa Koding Ulang**: Tambah sistem ternak/tanaman baru (Ayam, Lele, Kambing, Jamur, Sayur) langsung via formulir Admin Studio.
- **UI Lapangan Sederhana**: Tombol besar **Rawat** (hijau) & **Panen** (kuning), counter frekuensi harian, riwayat, dan tombol Undo instan.
- **Scanner & Generator QR Code**: Pindai QR di kandang langsung membuka status wadah terkait; unduh dan cetak stiker QR dari browser.

---

## 🚀 Panduan Clone & Setup Lokal

Proyek ini menggunakan struktur monorepo dengan **Bun** sebagai runtime dan package manager. Semua perintah dijalankan dari **root folder**.

### 1. Kloning Repository & Install Dependencies
```bash
git clone https://github.com/username/cymfarm.git
cd cymfarm
bun install
```

### 2. Salin & Konfigurasi File Environment
```bash
cp .env.example .env
```
Buka file `.env` di root dan isi kredensial yang dibutuhkan:
```env
# Akun Akses Masuk (Tanpa registrasi publik)
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="supersecretpassword"
USER_USERNAME="keluarga"
USER_PASSWORD="keluargapassword"
AUTH_SECRET="buat-string-acak-bebas-di-sini"

# Supabase & PostgreSQL (Bisa buat gratis di supabase.com)
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhxxxx..."
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres"
```

### 3. Migrasi Database Cloud
Jalankan migrasi skema tabel Drizzle ke Supabase:
```bash
bun run db:migrate
```

### 4. Jalankan Aplikasi di Komputer
```bash
bun run dev
```
Buka `http://localhost:3000` di browser komputer atau buka via IP LAN di HP: `http://<IP_KOMPUTER>:3000`.

---

## 🚢 Panduan Deployment

### Opsi A: Deploy ke Vercel (Paling Mudah & Direkomendasikan)

1. **Push repository** Anda ke GitHub / GitLab.
2. Buka dashboard [Vercel](https://vercel.com) -> **Add New Project** -> Import repository ini.
3. Pada halaman konfigurasi project di Vercel:
   - **Framework Preset**: Pilih **Next.js**.
   - **Root Directory**: Ubah / klik edit lalu pilih folder `main`.
   - **Install Command**: `bun install` (atau biarkan default).
   - **Build Command**: `bun run build` (atau `next build`).
4. **Environment Variables**: Masukkan seluruh isi dari file `.env` Anda ke tab *Environment Variables* di Vercel:
   - `NEXT_PUBLIC_APP_NAME`
   - `ADMIN_USERNAME` & `ADMIN_PASSWORD`
   - `USER_USERNAME` & `USER_PASSWORD`
   - `AUTH_SECRET`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `DATABASE_URL`
5. Klik **Deploy**.
6. *(Opsional)* Jika menggunakan Custom Domain di Vercel dengan Cloudflare:
   - Di Cloudflare DNS, set CNAME ke Vercel dengan mode **DNS Only** (bukan Proxied).

---

### Opsi B: Deploy ke Server Sendiri (VPS / Docker / PM2)

Jika menggunakan VPS (Ubuntu/Debian) mandiri:

1. **Persiapkan Server & Bun**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   source ~/.bashrc
   ```
2. **Clone & Setup**:
   ```bash
   git clone https://github.com/username/cymfarm.git
   cd cymfarm
   bun install
   cp .env.example .env
   # Edit .env dengan kredensial server & database Anda
   nano .env
   ```
3. **Build & Jalankan**:
   ```bash
   # Jalankan build Next.js dari root
   bun run build

   # Jalankan server produksi di port 3000
   bun run start
   ```
4. **Menjalankan di Background dengan PM2**:
   ```bash
   bun add -g pm2
   pm2 start "bun run start" --name "cymfarm"
   pm2 save
   pm2 startup
   ```
5. Pasang **Nginx Reverse Proxy** & **Let's Encrypt SSL (HTTPS)** agar fitur PWA & akses kamera scan QR dapat aktif.

---

## 📖 Dokumentasi Lanjutan
- 📐 **[Arsitektur Sistem & Data Flow (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)**: Detail Dexie.js, LWW Conflict Resolution, dan Service Worker.
- 🔄 **[Alur Operasional & Use Case (`docs/USE_CASE.md`)](./docs/USE_CASE.md)**: Skenario panen, kelola populasi, dan formulir modular.
- 🛠️ **[Panduan Standar Monorepo (`docs/CONTRIBUTION.md`)](./docs/CONTRIBUTION.md)**: Standar instalasi package dari root wrapper dan migrasi skema.
