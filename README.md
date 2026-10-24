# jepret by wolfpuplabs

Kamera sekali pakai di HP. Pilih roll film, motret tanpa bisa melihat hasilnya, roll dicuci,
lalu bayar **sekali per roll** (QRIS / GoPay lewat Midtrans) untuk mengunduh resolusi penuh.

## Konsep

| Paket | Mode | Jepretan | Harga default |
| --- | --- | --- | --- |
| Roll 10 | Pribadi | 10 | Rp 9.000 |
| Roll 25 | Pribadi | 25 | Rp 19.000 |
| Roll 36 | Pribadi | 36 | Rp 25.000 |
| Party 100 | Acara | 100 | Rp 49.000 |
| Party 250 | Acara | 250 | Rp 99.000 |
| Party 500 | Acara | 500 | Rp 179.000 |

- **Roll pribadi**: hanya pemilik yang motret dan melihat hasilnya.
- **Roll acara**: satu roll dipakai bareng lewat QR; jepretan semua tamu mengurangi roll yang sama.
- Roll selesai saat jepretan habis, saat pemilik menekan "Kirim ke lab", atau (acara) saat waktu tutup.
- Dicuci: langsung, sejam kemudian, atau besok pukul 09.00 WIB.
- Melihat hasil gratis (pratinjau). Unduhan resolusi penuh terbuka setelah satu pembayaran harga roll —
  untuk roll acara, semua tamu bisa mengunduh.
- Tanpa akun: pemilik memegang link rahasia `/k/<slug>/<token>` untuk membuka roll di HP lain.
- Film look (13), aksesori AR (MediaPipe, Apache-2.0), bingkai saat unduh (Polaroid, Film, Kartu pos).
- Foto dihapus otomatis 30 hari setelah roll dicuci (cron harian).

## Stack

Next.js (App Router) · Neon Postgres · Vercel Blob · Midtrans Snap. Lihat `.env.example`.

Pengembangan lokal tanpa Neon/Blob: `LOCAL_DEV=1 npm run dev`.

Foto contoh di beranda dari Unsplash (lisensi Unsplash) — lihat `public/photos/CREDITS.md`.
