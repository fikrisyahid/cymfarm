# Panduan Kontribusi & Development (`CONTRIBUTION.md`)

## Aturan Emas (Golden Rules)
1. **Jangan Jalankan Perintah dari Dalam `/main` Secara Langsung**:
   Seluruh perintah development, instalasi package, manajemen `.env`, dan database **wajib dijalankan dari direktori root (`/`)** menggunakan `bun`.
2. **Satu File `.env` di Root**:
   Jangan pernah membuat atau mengedit `.env` secara manual di dalam folder `/main`. Cukup edit file `/.env` di root repository. Script `bun run env:sync` (yang otomatis dipanggil saat `bun run dev` dan `bun run build`) akan menyinkronkan file tersebut ke `/main`.

---

## Daftar Perintah dari Root (`/`)

| Kebutuhan | Perintah (Jalankan di Root) | Penjelasan |
| :--- | :--- | :--- |
| **Menjalankan Dev Server** | `bun run dev` | Otomatis sync `/.env` lalu menjalankan Next.js di `/main` |
| **Sinkronisasi `.env` Manual** | `bun run env:sync` | Menyalin `/.env` di root ke `/main/.env.local` & `/main/.env` |
| **Install Semua Dependency** | `bun install` | Menginstall seluruh dependency workspace dari root |
| **Tambah Package ke App** | `bun run add <nama-pkg>` | Menambahkan package baru ke `/main/package.json` |
| **Tambah Dev Dependency** | `bun run add -d <nama-pkg>` | Menambahkan devDependency ke `/main/package.json` |
| **Hapus Package** | `bun run remove <nama-pkg>` | Menghapus package dari `/main/package.json` |
| **Update Package** | `bun run update` | Memperbarui package di `/main` |
| **Cek TypeScript** | `bun run typecheck` | Menjalankan `tsc --noEmit` untuk memeriksa tipe di `/main` |
| **Build Produksi** | `bun run build` | Sync `.env` dan menjalankan production build Next.js |
| **Jalankan Migrasi Database** | `bun run db:migrate` | Otomatis generate SQL migrasi (jika skema berubah) & eksekusi migrasi ke PostgreSQL/Supabase |
| **Push Skema ke Supabase** | `bun run db:push` | Mendorong perubahan skema langsung ke database Supabase (prototyping/dev) |
| **Buka Drizzle Studio** | `bun run db:studio` | Membuka GUI database Drizzle Studio |
| **Jalankan Pipeline CI** | `bun run ci` | Menjalankan script `ops/ci.sh` (sync env, install, typecheck, build) |
