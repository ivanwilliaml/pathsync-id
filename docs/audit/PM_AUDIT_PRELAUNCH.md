# PathSync — Audit Produk Pra-Launch

**Peran auditor:** Product Manager · **Tanggal:** 11 Oktober 2026 · **Basis:** commit `e251bd4` (Platform v1), aplikasi berjalan lokal (Next.js dev :3000 + FastAPI :8000)
**Metode:** uji langsung di browser (desktop 800 px & mobile 375 px) sebagai mahasiswa, admin, dan tamu; uji API langsung (curl); pembacaan kode backend/frontend; analisis bank soal; `pytest` (36/36 lulus).

> Semua temuan bertanda 🔬 **dibuktikan dengan uji langsung** di sesi audit ini, bukan hanya dibaca dari kode.

---

## 0. Ringkasan Eksekutif

PathSync punya **fondasi yang jauh di atas rata-rata purwarupa lomba**. Ada data lowongan nyata dengan kutipan yang bisa ditelusuri, mesin keputusan yang transparan (halaman *How the AI Works* sangat kuat), hak data UU PDP, tes otomatis, CI, dan UI yang rapi serta responsif. Audit internal sebelumnya (docs/audit/AUDIT.md) menutup banyak lubang besar.

Namun **janji inti produk**, yaitu *"diagnosis berbasis bukti, bukan tebakan"*, saat ini **masih bisa dibobol dengan mudah**. Ini terlihat di tiga titik: bank soal (jawaban bisa ditebak), rubrik proyek (teks karangan langsung diberi nilai "mahir"), dan sertifikat (cukup diketik). Selain itu ada beberapa risiko operasional yang akan langsung terasa di hari launch: rate limit, kehilangan akun, dan server dev.

### Rekomendasi keputusan: **GO bersyarat (soft launch / beta tertutup)**
Jangan launch publik terbuka sebelum **7 blocker P0** di bawah diperbaiki. Dengan sisa beberapa hari, semua P0 realistis selesai dalam ±3–4 hari kerja (estimasi per item ada di §9).

### Skor per area

| Area | Skor | Komentar singkat |
|---|---|---|
| Visi & proposisi nilai | 8/10 | Jelas, berbeda dari "LLM generik", berbasis data lokal |
| Fitur & kelengkapan | 7/10 | Lengkap, bahkan terlalu banyak untuk v1 (scope creep) |
| UX / alur pengguna | 6/10 | Alur bagus, tapi titik rawan di akun, loading, dan kejujuran label |
| UI / tampilan | 8/10 | Konsisten, bersih, mobile aman (tanpa overflow di 375 px) |
| Integritas AI / model | **4/10** | Bisa dicurangi; prioritas #1 didominasi soft skill generik |
| Backend & keamanan | 6/10 | Auth & batas upload baik; rate limit dan proxy bermasalah |
| Kesiapan operasional | **4/10** | Masih dev server, SQLite, token demo, tanpa monitoring |
| Kepatuhan & kepercayaan | 6/10 | Ekspor/hapus data ada; teks persetujuan tidak akurat |

---

## 1. Blocker Launch (P0) — wajib sebelum go-live

### P0-1 🔬 Bank soal bisa ditebak: "opsi terpanjang = benar" di 83% soal
- **Bukti:** analisis 210 butir. Versi Inggris (yang tampil di UI): opsi terpanjang adalah jawaban benar di **174/210 (83%)**. Versi Indonesia: **183/210 (87%)**.
- **Contoh:** *"Active listening means:"* → jawaban benar adalah satu-satunya opsi yang panjang dan detail.
- **Dampak:** asesmen berbobot **0,50**, tertinggi di persamaan (2). Mahasiswa yang selalu memilih opsi terpanjang tanpa paham materi akan mendapat akurasi ±83%, sehingga penguasaan dan *Role Readiness* melambung. Ini meruntuhkan klaim "Proof over claims". Begitu trik ini menyebar di grup angkatan, seluruh data kalibrasi juga ikut rusak.
- **Perbaikan:**
  1. Tulis ulang distraktor supaya panjang dan tingkat detailnya setara (target: opsi terpanjang benar ≤ 30%, mendekati 25%).
  2. Tambahkan **tes CI**: gagal jika rasio "terpanjang = benar" > 35% atau posisi jawaban tidak seimbang.
  3. Jangka menengah: analisis butir (p-value, daya beda) dari data respons nyata.

### P0-2 🔬 Rubrik proyek memberi "mahir" untuk teks karangan dan bisa dikirim berulang
- **Bukti:** teks karangan ±120 kata yang memuat satu CTE + `ROW_NUMBER() OVER (PARTITION BY …)` + `import pandas` + `from sklearn…`:
  - langsung dinilai **SQL = mahir, Python = mahir**, plus 8 skill lain "dasar";
  - status **`auto`** (tanpa review), tanpa flag apa pun;
  - **teks identik dikirim 6×** dan diterima semua. Tidak ada deteksi duplikat.
  - Hasilnya penguasaan SQL = **1,00** dengan confidence 0,996 tanpa satu soal pun dijawab.
- **Penyebab:** `_heuristic_rubric` menentukan level SQL/Python dari **regex kata kunci** (`over (`, `with … as (`, `from sklearn`). Kode bisa disalin dari tutorial mana pun. Sampel review 20% juga deterministik dari `sha1(title + text)`, sehingga cukup **ganti judul** sampai lolos sampel.
- **Kebalikannya juga terjadi (penilaian terlalu rendah):** proyek nyata (wawancara 17 orang, 14 user story, BPMN, BRD) hanya diberi **Requirements Elicitation = Basic**. Kutipan bukti untuk SQL malah 200 karakter pertama dokumen, bukan baris query-nya. Rubrik tidak adil ke dua arah.
- **Perbaikan:**
  1. **Tanpa LLM/review manusia: batasi level heuristik maksimal "dasar/mandiri"** untuk semua skill, termasuk SQL/Python. Level "mahir" hanya lewat review manusia atau asesmen.
  2. Deduplikasi: tolak artefak dengan kemiripan ≥ 0,9 terhadap artefak milik siswa yang sama maupun siswa lain (TF-IDF sudah tersedia).
  3. Sampel review **acak sungguhan** (`secrets`), bukan hash konten.
  4. Batasi jumlah proyek per hari, misalnya 5.
  5. Perbaiki pemilihan kutipan agar menunjuk baris yang relevan.

### P0-3 🔬 Rate limit bisa dibobol, dan di Docker semua pengguna berbagi satu IP
- **Bukti:** 12 pendaftaran lewat proxy Next.js dengan header `X-Forwarded-For` palsu → **semua lolos**. Langsung ke backend tanpa header → permintaan ke-11 diblok (429).
- **Penyebab:** limiter memakai `request.client.host`. Uvicorn mempercayai `X-Forwarded-For` dari 127.0.0.1, sehingga di setup lokal klien bisa memalsukan IP.
  - Di `docker-compose`, uvicorn **tidak** dijalankan dengan `--proxy-headers/--forwarded-allow-ips` untuk container frontend. Akibatnya **semua pengguna terlihat sebagai IP container frontend**: *signup dibatasi 10/menit untuk seluruh Indonesia*, upload 30/menit, asesmen 60/menit secara global. Di hari launch dengan trafik dari grup kampus, pendaftar akan kena **"Too many requests"**.
- **Perbaikan:** tempatkan reverse proxy (Nginx/Caddy/Cloudflare) yang menimpa `X-Forwarded-For`. Jalankan uvicorn dengan `--proxy-headers --forwarded-allow-ips=<ip proxy>`. Kunci limiter memakai IP dari proxy tepercaya + ID mahasiswa untuk rute yang sudah login. Pindahkan limiter ke Redis (sudah tercatat di R7). Uji beban sederhana (k6/locust: 200 signup dalam 5 menit).

### P0-4 🔬 Kehilangan akses akun permanen (tanpa pemulihan)
- **Bukti:** setelah pane browser dibuka ulang, localStorage kosong dan profil "hilang" (*Create Your Profile First*). Profil hanya bisa dipulihkan karena auditor menyimpan access key secara manual.
- **Masalah UX:**
  - Access key hanya disebut di **toast** yang hilang dalam beberapa detik ("Your access key is in Settings").
  - Mahasiswa memakai HP, berganti browser, mode incognito, atau membersihkan cache. Mereka **akan** kehilangan profil dan semua bukti tanpa jalan kembali.
  - `api.ts` otomatis **menghapus sesi** pada 401/403 di rute siswa. Satu token yang tidak cocok sudah cukup membuat pengguna "logout" tanpa peringatan.
- **Perbaikan (pilih minimal satu sebelum launch):**
  1. Langkah wajib setelah signup: layar **"Simpan kunci Anda"** dengan tombol *Copy*, *Download .txt*, dan *Kirim ke email saya* (email opsional), plus checkbox "Saya sudah menyimpan".
  2. Lebih baik: **magic link email** (tetap tanpa password), atau login Google. Untuk B2B kampus, SSO nantinya.
  3. Ubah perilaku 401/403: tampilkan dialog "Masukkan kunci akses", jangan hapus diam-diam.

### P0-5 🔬 Request yang "menggantung" tanpa batas waktu
- **Bukti:** "Save Transcript" tertahan di **"Saving…" lebih dari 50 detik**. Server sebenarnya **sudah menyimpan data** (terverifikasi lewat API), tetapi UI tidak pernah menerima respons. Setelah reload, data muncul. Request yang sama langsung ke backend selesai dalam 0,4 detik, jadi masalahnya ada di lapisan proxy dev atau klien.
- **Penyebab di klien:** `request()` di `lib/api.ts` tidak punya timeout atau `AbortController` dan tidak punya retry idempoten. Tombol terkunci selamanya.
- **Perbaikan:** timeout 20–30 detik + pesan "Masih memproses… [Coba lagi] [Muat ulang]". Setelah timeout, *refetch* status bukti. Jadikan endpoint simpan idempoten (transkrip sudah *replace*, bagus). Tampilkan indikator progres untuk upload PDF.

### P0-6 Kesiapan deployment: masih dev server, token demo, SQLite
- **Bukti:** indikator Next.js "Compiling…" muncul di setiap navigasi. Backend memakai `data/pathsync.db` (SQLite). Token admin `demo-admin-key-2026` dipakai di skrip start. Kedua server **mati sendiri** di tengah audit (proses induknya tertutup), sehingga aplikasi tidak dapat diakses sampai dinyalakan ulang manual.
- **Perbaikan:** deploy dengan `docker compose` (PostgreSQL + `next build && next start`) di host yang punya process manager/restart policy; HTTPS; **token admin baru acak ≥ 32 karakter** (simpan di secret manager); backup DB harian + uji restore; uptime monitor (UptimeRobot/BetterStack) + error tracking (Sentry FE/BE).
- Halaman login admin **menampilkan nama env var dan path file token** (`PATHSYNC_ADMIN_TOKEN`, `backend/data/admin_token.txt`) ke publik. Hapus teks itu dari UI.

### P0-7 Teks persetujuan data tidak akurat (risiko UU PDP)
- Modal signup: *"They are not shared"*. Halaman Settings: *"We use your data only to build your own route."*
- Faktanya data **juga** dipakai untuk: laporan kohort dosen (agregat k≥5), studi 4 lengan (penelitian, randomisasi), kalibrasi bobot dari pasangan bukti–asesmen, dan review proyek oleh admin/manusia.
- **Perbaikan:** halaman **Kebijakan Privasi** (Bahasa Indonesia) yang menyebut tujuan, pihak yang melihat (admin reviewer, dosen agregat), retensi, dan kontak DPO. Pisahkan **persetujuan penelitian** sebagai opt-in terpisah. Ubah teks modal agar jujur. Simpan versi persetujuan (sudah ada).

---

## 2. Kualitas AI & Rekomendasi (P1)

| # | Temuan | Bukti | Rekomendasi |
|---|---|---|---|
| AI-1 | 🔬 **Prioritas #1 = soft skill generik.** Profil uji (transkrip + sertifikat + proyek BA) mendapat *Your Next Step: Verbal and Interpersonal Communication*, lalu Critical Thinking. | Masalah S12 di AUDIT.md masih terbuka; ekstraktor leksikon menangkap "good communication skills" di 71% lowongan. | Untuk launch: **pisahkan soft skill** ke jalur "Pendukung" (tidak bersaing di Top-3), atau beri faktor diskon untuk skill dengan spesifisitas rendah. Hal pertama yang dilihat pengguna adalah "belajar komunikasi", dan itu langsung menurunkan kepercayaan. |
| AI-2 | 🔬 Estimasi waktu tidak realistis: "Communication, **Beginner to Advanced, about 7,1 h**". | Dasbor | Tampilkan estimasi per *langkah* ("modul pertama ±2 jam"), bukan klaim "sampai Advanced". |
| AI-3 | 🔬 Sertifikat cukup **diketik** (tanpa URL/ID kredensial) dan berbobot 0,25, lebih besar dari nilai transkrip. "Google Data Analytics" langsung memberi Data Analysis 0,60. | Wizard → Certificates | Wajibkan URL verifikasi (Coursera/Dicoding/Credly) untuk bobot penuh; tanpa URL perlakukan sebagai *klaim* (seperti CV). |
| AI-4 | 🔬 Transkrip 6 mata kuliah → **15 skill** "ditemukan" (mis. Requirements Elicitation 0,57 dari "Analisis dan Perancangan Sistem"). | Saved Evidence | Tampilkan pemetaan mata kuliah → skill **sebelum** disimpan agar bisa dikoreksi; tunjukkan "bukti tidak langsung" secara visual. |
| AI-5 | Bank soal hanya **5 butir per skill**. Setelah diagnostik (24) + 1–2 kali asesmen ulang, bank habis dan pengguna diarahkan ke bukti proyek, yang saat ini paling mudah dicurangi (P0-2). | `assessment.py` | Target ≥ 15 butir/skill untuk 10 skill teratas; prioritaskan soal berbasis kasus/skenario. |
| AI-6 | Model peringkat dilatih dari **pakar tersimulasi**. Kolom "Generic LLM" di How-it-works kosong ("–"), padahal README mengklaim hasilnya. Ada 0 pakar terdaftar. | /how-it-works, Admin | Tetap transparan (sudah bagus). Pasang badge "Beta — divalidasi dengan 0 pakar nyata" sampai panel nyata selesai. Isi atau hapus kolom LLM. |
| AI-7 | Halaman How-it-works menyebut "Claude API (when a key is configured)", padahal saat ini tidak ada key dan ekstraktor aktif adalah leksikon. | /how-it-works | Tampilkan hanya yang **aktif**; sisanya di bagian "rencana". |
| AI-8 | Label level di API masih berbahasa Indonesia (`mahir`, `dasar`, `pelajari`/`buktikan`) sementara UI berbahasa Inggris. | Respons API | Pakai enum netral (`proficient`) + lapisan i18n. |
| AI-9 | 83 kecocokan skill & 8 proyek menunggu review, dengan **0 reviewer**. Status "pending" = setengah bobot tanpa batas waktu. | Admin | SLA review (mis. 72 jam). Tetapkan siapa reviewer pada minggu launch. Beri notifikasi ke mahasiswa saat reviewnya selesai. |

---

## 3. UX / Alur Pengguna

### Yang sudah baik
- Landing jelas ("Know Exactly What to Learn Next"), CTA tunggal, contoh rute konkret.
- Wizard bukti 5 langkah, semua opsional, dengan status ✔ per langkah dan panel "Saved Evidence".
- Parser transkrip memberi tabel yang bisa diedit sebelum disimpan. Ini sangat baik.
- Hasil proyek menampilkan **kutipan bukti** per skill. Transparansinya kuat.
- Dasbor fokus pada "Your Next Step" + tombol "I Already Know This" (jalan pintas untuk membuktikan).
- Mobile 375 px: tidak ada overflow horizontal, ada menu hamburger, hierarki tetap terbaca.
- Settings: ekspor/hapus data dan access key yang disamarkan + Copy.

### Masalah & rekomendasi

| # | Prioritas | Temuan | Rekomendasi |
|---|---|---|---|
| UX-1 | P1 | **Bahasa:** seluruh UI berbahasa Inggris, padahal target pengguna mahasiswa Indonesia dan datanya lowongan Indonesia. Placeholder transkrip berbahasa Indonesia, profil default `language: "id"`, tanggal ditulis "10/11/2026" (format AS, ambigu). | Tambahkan **Bahasa Indonesia sebagai default** (setidaknya untuk alur mahasiswa) dengan toggle EN. Format tanggal `11 Okt 2026`. |
| UX-2 | P1 | 🔬 **Angka tidak konsisten:** landing "Based on **80** real postings", sedangkan dasbor/pasar "**45** postings". | Selalu tampilkan per peran ("45 lowongan BA"). Angka 80 = total unik BA + DA. |
| UX-3 | P1 | Landing: "**Free, no account needed**", padahal pengguna membuat profil + kunci akses (de facto akun). | "Gratis · tanpa email & password". |
| UX-4 | P1 | Menu mahasiswa menampilkan **Lecturer View, Expert Panel, Admin** (tamu juga melihat "Admin"). Ini membingungkan dan membuka permukaan serangan. | Sembunyikan menu staf; akses lewat URL khusus/subdomain `staff.`. |
| UX-5 | P2 | 🔬 Di lebar ±800 px, tab wizard terpotong ("Transcri…", "Certific…", "Prefere…") dan nama mata kuliah di input terpotong. | Breakpoint: stepper vertikal/kompak < 900 px; input nama mata kuliah lebar penuh. |
| UX-6 | P2 | Footer landing: "**research prototype** by Team cupuu". Ini menurunkan kepercayaan untuk produk yang di-launch. | Ganti dengan halaman Tentang + kontak + kebijakan privasi. |
| UX-7 | P2 | Tidak ada onboarding yang menjelaskan *kenapa* "Communication" muncul pertama, dan tidak ada empty state yang mendorong asesmen setelah bukti diisi. | Setelah wizard: CTA tunggal "Ambil Quick Check (20 menit) agar rute lebih akurat". |
| UX-8 | P2 | Pulse "I know which skill to learn next and why" (1–5) tampil di dasbor sebelum pengguna sempat memahami rute. | Tampilkan setelah pengguna membuka "See Why and How" atau pada kunjungan ke-2. |
| UX-9 | P2 | Mata kuliah di Classroom & rencana mingguan "Self-study" kosong bila tidak ada mata kuliah. Nilainya baru terasa setelah setup panjang. | Isi otomatis mata kuliah dari transkrip semester berjalan. |
| UX-10 | P3 | Request duplikat saat load (`/api/meta` ×4, `/catalog` ×2, `/students/{id}` ×2). Sebagian karena StrictMode dev, sisanya karena tidak ada cache. | SWR/React Query dengan dedup + cache `meta/catalog`. |

---

## 4. UI / Tampilan
- **Kuat:** design system konsisten (shadcn + Plus Jakarta Sans), palet ungu yang tenang, ring *Role Readiness* informatif, kartu jelas, kontras baik.
- **Perbaiki:**
  - Tidak ada favicon/OG image/`robots.txt`/sitemap. Saat link dibagikan di WhatsApp/LINE, tidak ada preview. **Ini penting untuk launch via grup kampus.** Tambahkan `opengraph-image`, `icon`, `metadataBase`.
  - Foto stok Unsplash bersifat generik. Pertimbangkan ilustrasi/screenshot produk di hero (tunjukkan dasbor asli).
  - Tombol nonaktif ("Read Transcript", "Save Certificates") tidak menjelaskan alasannya. Tambahkan helper text.
  - Toast penting (access key) terlalu singkat. Jadikan modal (lihat P0-4).

---

## 5. Backend, Keamanan & Data

| # | Prioritas | Temuan | Rekomendasi |
|---|---|---|---|
| BE-1 | P0 | Rate limiter (lihat P0-3). | — |
| BE-2 | P1 | Token mahasiswa **dan token admin/staf disimpan di `localStorage`**. Satu XSS sama dengan pengambilalihan akun admin. | Staf: cookie `HttpOnly; Secure; SameSite=Strict` + masa berlaku. Tambahkan CSP header di Next.js. |
| BE-3 | P1 | Token staf/mahasiswa **tidak kedaluwarsa** dan tidak ada rotasi untuk mahasiswa. | Tambahkan "Buat ulang kunci" di Settings; expiry token staf 30 hari. |
| BE-4 | P1 | `embeddings.encode` memakai **satu lock global** + membuka koneksi SQLite di setiap panggilan. Encode yang lambat memblokir semua upload pengguna lain. | Kunci hanya saat memuat model; cache SQLite per-thread/pooling; atau precompute embedding katalog. |
| BE-5 | P1 | SQLite untuk produksi (penulisan bersamaan + WAL) dan berkas `pathsync.db` ada di repo. | PostgreSQL (compose sudah siap). Keluarkan `.db` dari git. |
| BE-6 | P2 | `self_ratings` menerima key sembarang, dan `int(v)` non-numerik memicu 500. | Validasi key ∈ taksonomi, gunakan Pydantic `conint(1,5)`. |
| BE-7 | P2 | Tidak ada logging terstruktur / audit log aksi admin (aktivasi model, simulasi pasar, hapus token). | Audit log tabel + tampilkan di Admin. |
| BE-8 | P2 | Scraping bulanan bergantung pada GitHub Actions + run manual. Tren masih `insufficient`. | Jadwalkan job di server; alert bila snapshot gagal. |
| BE-9 | ✅ | Hal baik: hash token SHA-256, `compare_digest`, batas upload 5 MB / 200 ribu karakter, whitelist ekstensi, header keamanan, handler 500 generik, migrasi Alembic, 36 tes lulus (13 detik). | Pertahankan; tambahkan tes regresi untuk P0-1 s.d. P0-3. |

---

## 6. Fitur & Strategi Produk

1. **Scope v1 terlalu lebar.** Ada 15 halaman: classroom, advisor, studi 4 lengan, panel pakar, anotasi, simulasi pasar, dan seterusnya. Untuk launch, **satu loop inti** yang harus sempurna adalah: *Daftar → Bukti → Quick Check → Next Step → Belajar → Buktikan ulang*. Sembunyikan Classroom/Advisor/Studi di balik *feature flag* sampai ada dosen pilot.
2. **Dua peran (BA/DA)** adalah keputusan yang tepat untuk fokus. Komunikasikan dengan jelas di landing ("Peran lain segera hadir — daftar notifikasi") agar mahasiswa jurusan lain tidak pergi tanpa jejak, dan kumpulkan email minat.
3. **Data pasar tipis:** 45 lowongan BA (target paper 500–1.000). Persentase seperti "71% lowongan" dari n=45 harus menampilkan ukuran sampel (sudah ada "32 of 45", bagus) dan interval. Prioritaskan menambah sumber (JobStreet/Glints via kemitraan, LinkedIn tidak).
4. **Loop retensi lemah:** belum ada notifikasi atau email mingguan ("pasar berubah, rute Anda berubah"), padahal fitur adaptifnya sudah ada di backend. Itu nilai jual yang tidak terlihat.
5. **Metrik North Star yang disarankan:** % pengguna yang **membuktikan ≥1 skill baru (asesmen ulang lulus) dalam 14 hari**. Turunan: aktivasi (selesai Quick Check), D7 retention, waktu ke "Next Step" pertama, NPS/pulse.
6. **Instrumentasi analitik belum ada** (tidak terlihat event tracking). Tanpa ini, launch tidak bisa dievaluasi. Pasang PostHog/Umami (self-host, ramah PDP) dengan event: `signup`, `evidence_saved{kind}`, `check_started/completed`, `next_step_viewed`, `material_clicked`, `reassess_passed`.

---

## 7. Kepatuhan & Kepercayaan
- ✅ Ekspor JSON & hapus total, versi persetujuan tersimpan, agregasi dosen k≥5.
- ❌ Belum ada Kebijakan Privasi & Syarat Layanan (lihat P0-7).
- ❌ Belum ada kontak/kanal bantuan (email support, form feedback). Tambahkan tombol "Laporkan masalah" yang menyertakan request ID (header `X-Request-ID` sudah ada).
- ⚠️ Atribusi foto Unsplash sudah ada. Pastikan materi pihak ketiga (121 tautan) dicek berkala (link rot) dan lisensinya dihormati.

---

## 8. Checklist Go/No-Go

| Item | Status |
|---|---|
| P0-1 Bank soal diseimbangkan + tes CI bias | ☐ |
| P0-2 Rubrik heuristik dibatasi + dedup + sampel acak | ☐ |
| P0-3 Reverse proxy + IP tepercaya + uji beban | ☐ |
| P0-4 Layar simpan kunci / magic link | ☐ |
| P0-5 Timeout + retry di klien | ☐ |
| P0-6 Build produksi, PostgreSQL, token admin baru, backup, monitoring | ☐ |
| P0-7 Kebijakan privasi + teks persetujuan jujur + opt-in riset | ☐ |
| OG/favicon untuk berbagi di WhatsApp | ☐ |
| Analitik event dasar | ☐ |
| Menu staf disembunyikan dari mahasiswa | ☐ |
| Smoke test end-to-end di lingkungan produksi (desktop + Android Chrome) | ☐ |

---

## 9. Rencana Kerja Pra-Launch (estimasi)

| Hari | Fokus | Item |
|---|---|---|
| H-4 | Integritas | P0-1 (tulis ulang distraktor 10 skill teratas dulu + tes CI), P0-2 (cap level + dedup + sampel acak) — ~1,5 hari |
| H-3 | Akun & keandalan | P0-4 (layar simpan kunci + download), P0-5 (timeout/retry), UX-4 (sembunyikan menu staf) — ~1 hari |
| H-2 | Infra | P0-3 + P0-6: deploy compose di VPS, Caddy/Nginx + HTTPS, Postgres, Sentry, uptime, backup; uji beban — ~1 hari |
| H-1 | Kepercayaan & polish | P0-7 privasi, OG image, angka 45/80, copy landing, AI-1 (soft skill tidak di Top-3), analitik — ~1 hari |
| H | Soft launch | Beta tertutup 50–100 mahasiswa (1–2 kelas), pantau dashboard error & funnel, *war room* 48 jam |

**Pasca-launch (2–4 minggu):** Bahasa Indonesia penuh, magic link email, verifikasi sertifikat via URL, perluasan bank soal ke 15/skill, panel pakar nyata, 150 anotasi emas, notifikasi mingguan, ekspansi sumber lowongan.

---

## Lampiran A — Data uji yang dibuat auditor (hapus sebelum launch)
- Mahasiswa `32fee852bb89` ("Audit Tester") dan `b7e69df07829` ("Audit API") beserta ±15 bukti proyek uji ("Proyek A–C", "Proyek X1–X6").
- Bisa dihapus lewat Settings → Delete My Profile, atau `DELETE /api/students/{id}` dengan token masing-masing. Database produksi sebaiknya dibangun bersih.

## Lampiran B — Cara mereproduksi temuan utama
```bash
# P0-1: bias opsi terpanjang
cd backend && PATHSYNC_LANG=en python -c "from pathsync.assessment import item_bank as b; b=b(); print(sum(max(range(4),key=lambda i:len(x['options'][i]))==x['answer'] for x in b.values()),'/',len(b))"
# P0-3: bypass rate limit lewat proxy
for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code} " -X POST localhost:3000/api/students -H 'Content-Type: application/json' -H "X-Forwarded-For: 10.0.0.$i" -d '{"consent":false}'; done
```
