# Audit UI/UX PathSync (6 Oktober 2026)

Acuan audit: **frontend-design** (Anthropic), **design-critique / ux-copy / accessibility-review** (plugin Design, Anthropic), **ui-ux-pro-max** (prioritas aturan 1–10 + generator design system), **Vercel Web Interface Guidelines**, konvensi **shadcn/ui** dan **Tailwind CSS 4**. Masukan pengguna (tim) dimasukkan sebagai temuan berprioritas tinggi.

## Kesan pertama (2 detik)

Halaman terasa seperti kerangka teknis, bukan produk untuk mahasiswa. Yang pertama menarik mata di dasbor adalah empat kartu statistik identik dengan label kapital kecil, bukan "apa yang harus saya pelajari sekarang". Tidak ada foto, tidak ada warna selain satu hijau-teal, dan hampir setiap kalimat menjelaskan rumus paper ("persamaan (6)", "interval Wilson", "akurasi terhaluskan") yang tidak dibutuhkan mahasiswa.

## Temuan per dimensi

### 1. Bahasa & copy (ux-copy, Vercel "Content & Copy")
| Temuan | Tingkat | Perbaikan |
|---|---|---|
| Campur Indonesia–Inggris (judul Indonesia, istilah "LTR", "NDCG", "lexicon", nama snapshot `2026-10-01-lexicon`) | 🔴 | Seluruh UI dan teks yang dihasilkan backend dalam bahasa Inggris |
| Judul & tombol tidak Title Case ("Profil & Bukti Kompetensi" ok, tapi "Buat profil", "Mulai asesmen", "Peta permintaan pasar") | 🟡 | Title Case untuk heading dan tombol (Chicago) |
| Subjudul terlalu panjang dan teknis (contoh: "Permintaan D = proporsi lowongan … 0,5^(umur/6 bulan) (persamaan 1)") | 🔴 | Satu kalimat yang menjawab "apa gunanya halaman ini bagiku"; detail metodologi dipindah ke tooltip atau halaman Admin |
| Meta string dengan titik tengah ("peta pasar … · model … · 43 lowongan") di banyak tempat — salah satu ciri desain "AI-generated" | 🟡 | Ganti dengan chip/label terstruktur atau hapus |
| Istilah internal bocor ke mahasiswa: "rec_type pelajari/buktikan", "G R K D T U B", "kontrafaktual", "formula (5)" | 🔴 | Pakai bahasa pengguna: "Learn" / "Prove It", "Why this order", sembunyikan fitur model di bagian "How We Ranked This" |

### 2. Hierarki visual & gaya (frontend-design, design-critique)
| Temuan | Tingkat | Perbaikan |
|---|---|---|
| "SaaS card kit": semua konten dipotong jadi kartu putih identik, radius & bayangan sama | 🔴 | Hierarki berbeda per jenis konten: panel hero bergradasi, daftar, rute belajar, tabel ringan |
| Label kapital kecil di atas setiap angka (CAKUPAN KESIAPAN, JALUR SAAT INI) — ciri template | 🟡 | Label sentence/Title Case, ukuran normal |
| Tidak ada foto/ilustrasi, tidak ada gradasi; satu warna aksen | 🔴 | Foto (Unsplash) di landing, kartu role, halaman asesmen & pakar; gradasi "rute" indigo→iris→oranye sebagai elemen khas |
| Tipografi default (Inter/system) tanpa skala yang jelas | 🟡 | Plus Jakarta Sans (hasil pencarian tipografi ui-ux-pro-max: "Friendly SaaS"), skala 13/15/17/20/26/34/48, angka tabular |
| Navigasi atas berisi 8 tautan yang di-scroll horizontal; area mahasiswa dan area tim (pakar/admin) bercampur | 🔴 | App shell dengan sidebar: grup "Your Journey" dan "Team Workspace"; menu ringkas di mobile |

### 3. Per halaman (masukan tim + temuan)
| Halaman | Masalah | Perbaikan |
|---|---|---|
| Landing | Teks panjang, form langsung di depan, tanpa visual | Hero foto + gradasi, headline pendek, pilih role lewat kartu bergambar, form di dialog |
| Peran | Hanya Business Analyst & Data Analyst tanpa penjelasan | Kartu role menjelaskan cakupan; BA/DA adalah batasan studi paper (BA target, DA peran berdekatan). Menambah role butuh scraping & penetapan level skill baru — dicatat sebagai keputusan terpisah |
| Profil & Bukti | Lima tab sejajar (Transkrip/Sertifikat/CV/Proyek/Kuesioner) membingungkan; tidak jelas mana yang wajib, tidak ada arah ke langkah berikutnya; kuesioner berupa 42 baris tombol 1–5 | Wizard bertahap dengan progres; setiap langkah bisa dilewati; setelah simpan muncul toast + tombol ke langkah berikutnya; penilaian diri hanya untuk skill penting peran, dalam dialog |
| Asesmen | Kartu polos, 24 kotak nomor, tanpa fokus | Satu soal per layar dengan foto header, progres bergradasi, pintasan keyboard 1–4, hasil berupa cincin skor + perubahan per skill |
| Dasbor | Terlalu banyak teks & tabel; prioritas tenggelam | Hero "Your Next Step" bergradasi, cincin kesiapan, 3 prioritas ringkas (alasan dibuka bila perlu), rute belajar sebagai elemen utama, detail (peringkat lengkap, urutan alternatif, kompetensi) di tab |
| Graf | 42 node + 50 sisi sekaligus, sulit dibaca | Tampilan terfokus: pilih skill → prasyarat ↔ skill ↔ yang dibuka; default skill prioritas #1; daftar ringkas jalurmu; graf penuh opsional |
| Peta pasar | Terlalu banyak angka (CI Wilson, tren, r, sumber, versi) dan teks | 10 skill teratas sebagai bar sederhana, satu angka per skill, kutipan lowongan di panel samping; daftar lowongan di tab kedua; tanpa istilah statistik |
| Admin | Pembaruan pasar tidak bisa dihentikan | Tombol **Stop** (backend membatalkan proses scraping/build) + konfirmasi sebelum mulai |
| Panel Pakar | Terlalu banyak hal sekaligus (daftar 50 sisi, form usulan, model, evaluasi) | Dua tugas jelas dengan progres; validasi sisi satu per satu ("Should A come before B?" Yes/No/Unsure); peringkat skenario dengan klik berurutan; model & evaluasi dipindah ke Admin |

### 4. Aksesibilitas & interaksi (Vercel guidelines, ui-ux-pro-max prioritas 1–2)
| Temuan | Lokasi | Perbaikan |
|---|---|---|
| Tombol ikon tanpa `aria-label` (hapus bukti, panah naik/turun, jempol) | profil, pakar | `aria-label` + tooltip |
| Tidak ada `focus-visible` ring yang konsisten | semua | ring fokus dari token `--ring` (shadcn) |
| `confirm()` bawaan browser untuk aksi destruktif | profil | Dialog konfirmasi |
| Tidak ada `aria-live` untuk umpan balik async (tersimpan, error) | semua form | Toast (sonner) dengan region live |
| Teks muted di atas abu-abu (`#5b6672` di `#f2f4f7`) mendekati batas 4.5:1 | badge, stat | Token warna dengan kontras ≥ 4.5:1 |
| Tidak menghormati `prefers-reduced-motion` | — | Animasi hanya transform/opacity dan dimatikan saat reduced motion |
| "..." alih-alih "…", tanda kutip lurus | beberapa | Tipografi benar |
| Target sentuh < 44 px (kotak nomor soal 28 px, tombol 1–5 24 px) | asesmen, kuesioner | ≥ 40–44 px |
| Tanggal diformat manual | riwayat | `Intl.DateTimeFormat` |

### 5. Konsistensi
- Komponen buatan sendiri (`ui.tsx`) dengan varian tidak lengkap → diganti **shadcn/ui** (Button, Card, Dialog, Tabs, Progress, Tooltip, Sheet, Sonner, dll.) di atas token tema Tailwind 4.
- Warna hardcode di SVG graf → token CSS.

## Design system yang dipakai

Generator ui-ux-pro-max (`--design-system`) dijalankan dua kali. Run pertama mengarah ke gaya anak-anak (Claymorphism, Comic Neue) dan run kedua ke dark mode untuk aplikasi audio; keduanya **tidak cocok** untuk mahasiswa yang menyiapkan karier. Sesuai aturan skill, hasil itu tidak dipakai mentah-mentah; yang diambil hanya sinyal yang konsisten di kedua run (primary indigo + aksen oranye hangat, light mode, hindari jargon) ditambah pencarian tipografi.

| Token | Nilai | Peran |
|---|---|---|
| Ink | `#1B1740` | teks utama, panel gelap |
| Indigo | `#4338CA` | primary, tautan, fokus |
| Iris | `#7C6CF6` | tengah gradasi, sekunder |
| Ember | `#F2711C` | aksen: prioritas, titik hambat, CTA penting |
| Mint | `#0E9F8A` | sudah dikuasai / berhasil |
| Paper | `#F6F6FB` | latar halaman |

- **Tipe:** Plus Jakarta Sans saja (satu keluarga), heading Title Case, angka tabular.
- **Elemen khas:** gradasi "rute" indigo → iris → ember hanya dipakai untuk jalur belajar, cincin kesiapan, progres asesmen, dan hero. Bagian lain tenang.
- **Hindari:** eyebrow kapital, meta string bertitik tengah, panah "→" di teks tombol, kartu identik untuk semua hal.
- **Foto:** Unsplash License (bebas dipakai, kredit di footer).

## Daftar perubahan (urut prioritas)

1. Seluruh UI + teks backend (nama skill, penjelasan, riwayat, peringatan, 210 soal asesmen) ke bahasa Inggris.
2. Design system baru (token, font, gradasi) + shadcn/ui menggantikan komponen buatan sendiri.
3. App shell: sidebar dengan grup mahasiswa / tim, header ringkas di mobile.
4. Landing baru dengan foto, kartu role, langkah "How It Works", form di dialog.
5. Profil → wizard bertahap (Transcript → Certificates → Projects → CV → Preferences) dengan progres, toast, dan tombol lanjut; penilaian diri di dialog.
6. Asesmen → satu soal per layar, pintasan keyboard, hasil berupa cincin skor.
7. Dasbor → hero "Your Next Step", cincin kesiapan, 3 prioritas ringkas, rute belajar, detail di tab.
8. Graf → tampilan terfokus per skill + jalurmu; graf penuh opsional.
9. Peta pasar → 10 skill teratas, kutipan di panel samping, tanpa istilah statistik.
10. Panel pakar → dua tugas berprogres, validasi sisi satu per satu, peringkat dengan klik berurutan; model & evaluasi pindah ke Admin.
11. Admin → tombol Stop untuk pembaruan pasar + konfirmasi.
12. Aksesibilitas: aria-label, focus ring, toast live region, reduced motion, target sentuh, `Intl` untuk tanggal.

Keputusan terpisah (tidak dikerjakan otomatis): menambah role di luar BA/DA (butuh scraping ulang dan penetapan level skill per role).

## Status pelaksanaan

Semua 12 butir di atas sudah dikerjakan (6 Oktober 2026). Verifikasi: build Next.js bersih, 23 tes backend lulus, setiap halaman dicek di 1280 px dan 375 px (tanpa scroll horizontal), dan pemeriksaan anti-pattern pedoman Vercel bersih (tanpa `transition: all`, gambar berukuran eksplisit, tombol ikon berlabel, tanggal via `Intl`, teks kontras ≥ 4.5:1). Temuan tambahan saat verifikasi yang ikut diperbaiki: urutan "Your Route" di Skill Map kini sama dengan dasbor, daftar skill pasar diurutkan sesuai angka yang ditampilkan, gradasi logo hilang di mobile (ID gradien ganda), grid halaman bukti melebar di 375 px.
