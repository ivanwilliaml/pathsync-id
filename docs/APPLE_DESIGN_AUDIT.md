# Audit UI PathSync dengan prinsip "Apple design"

Acuan: skill `apple-design` (emilkowalski/skills). Yang diaudit adalah frontend di branch `review/final-improvements` per 17 Okt 2026: tema Langit pagi, maskot Sync di semua halaman, dan loader. Buktinya berasal dari kode dan pengecekan di browser lokal (build produksi).

## Ringkasan

PathSync adalah aplikasi web berbasis formulir dan bacaan. **Tidak ada interaksi seret (drag), geser, atau gestur.** Karena itu sebagian besar prinsip inti skill ini tidak berlaku: manipulasi langsung, spring, velocity handoff, momentum, rubber-banding, dan ambang gestur.

Bagian yang berlaku dan perlu dibenahi ada empat:

1. **Umpan balik saat ditekan (pointer-down) belum ada** di elemen yang paling sering disentuh: kartu jawaban Quick Check dan kartu karier.
2. **Preferensi aksesibilitas baru dipenuhi sebagian.** `prefers-reduced-motion` sudah ditangani, tetapi `prefers-reduced-transparency` dan `prefers-contrast` belum.
3. **Ukuran teks memakai px tetap** (50 tempat), sehingga tidak ikut membesar saat pengguna menaikkan ukuran font browser.
4. **Tipografi judul besar belum dirapatkan.** Judul 40–54 px masih memakai tracking bawaan.

## Temuan per prinsip

| Prinsip | Status | Bukti | Saran |
|---|---|---|---|
| Respons saat pointer-down | **Kurang** | Kartu jawaban Quick Check (`components/quiz.tsx`) hanya punya gaya `hover` dan gaya terpilih. Di ponsel tidak ada hover, jadi tidak ada umpan balik sampai jari diangkat. Hanya 2 gaya `active:` di seluruh halaman. | Tambahkan `active:scale-[0.98]` dan warna tekan di kartu jawaban, kartu karier, dan baris prioritas. Durasinya pendek, sekitar 100 ms. |
| Tanpa latensi buatan | Sesuai | Tidak ada debounce atau jeda buatan. `setTimeout` hanya untuk batas waktu request dan membersihkan URL unduhan. | Tidak perlu diubah. |
| Interruptible, jangan kunci input | Sesuai | Animasi hanya untuk loader dan buka-tutup dialog atau sheet. Tidak ada input yang dikunci selama transisi. | Tidak perlu diubah. |
| Hanya animasikan `transform` dan `opacity` | **Sebagian** | `Button` memakai `transition-all` (2 tempat). Loader menganimasikan `background-position` dan `mask-position` (repaint di setiap frame, tapi elemennya kecil). | Ganti `transition-all` dengan `transition-[color,background-color,border-color,box-shadow,transform]`. Loader cukup dipantau: geser strip dengan `transform` hanya kalau terlihat patah di HP murah. |
| Konsistensi ruang | Sesuai | Sheet skill masuk dan keluar dari kanan (`data-starting-style` / `data-ending-style` simetris). Dialog dan popover tertambat ke pemicunya (Base UI). Maskot di header halaman selalu di kiri judul. | Tidak perlu diubah. |
| Material (backdrop blur) | **Sebagian** | Header mobile `bg-background/90 backdrop-blur`, dan overlay dialog `backdrop-blur-xs` sudah di dalam `supports-backdrop-filter`. | Tambahkan fallback permukaan padat untuk `prefers-reduced-transparency`. |
| Reduced motion | Sesuai | Aturan global di `globals.css` mematikan animasi dan transisi. Loader maskot jadi diam berwarna hijau. | Tidak perlu diubah. |
| Reduced transparency | **Belum** | Belum ada media query-nya. | `@media (prefers-reduced-transparency: reduce)`: header dan overlay dibuat padat, tanpa blur. |
| Kontras lebih tinggi | **Belum** | Belum ada `prefers-contrast` atau `forced-colors`. Teks sekunder (`text-ink/70`, muted #4A5B75) dan border #DCE5F0 tipis. | `@media (prefers-contrast: more)`: gelapkan muted-foreground dan border, beri garis tepi pada kartu. |
| Tipografi: tracking menurut ukuran | **Kurang** | Judul landing 54 px dan Quick Check 40 px memakai tracking bawaan. Hanya 10 elemen yang memakai `tracking-tight` atau `leading-tight`. | Judul ≥ 32 px diberi `tracking-[-0.02em]` dan leading 1.05–1.1. Body tetap leading lega. |
| Tipografi: hormati ukuran teks pengguna | **Kurang** | 50 kelas `text-[Npx]` di halaman. Px tidak ikut skala ukuran font browser (zoom tetap berfungsi). | Ubah ke `rem` (misalnya `text-[15px]` jadi `text-[0.9375rem]`) atau skala Tailwind. Dikerjakan bertahap, mulai dari body dan label. |
| Tipografi: font sistem | Pilihan sadar | Plus Jakarta Sans dengan fallback `system-ui` dan `-apple-system`. Font merek adalah identitas visual, bukan pelanggaran. | Tidak perlu diubah. |
| Label spesifik | Sesuai | Tombol diawali kata kerja dan jelas, misalnya "See Why and How", "Take the Quick Check", "Download My Data", "Keep My Profile". | Tidak perlu diubah. |
| Wayfinding dan pengelompokan | Sesuai | Sidebar tetap, header halaman dengan maskot yang konsisten, langkah evidence bertahap. | Tidak perlu diubah. |
| Umpan balik multimodal yang bermakna | Sesuai | Maskot hasil Quick Check mengikuti skor (merayakan, berpikir, sedih) bersama ring persentase. Toast muncul setelah simpan. Haptik tidak relevan di web. | Tidak perlu diubah. |
| Simplicity dan craft | **Perlu dijaga** | Maskot sekarang ada di hampir semua layar. Dashboard punya 3 (kompas, timbangan, kaca pembesar), tapi dua di antaranya di tab yang tidak tampil bersamaan. | Batasi satu maskot per layar yang terlihat. Di mobile maskot sudah disembunyikan, kecuali empty state dan 404. |
| Delight | Sesuai | Loader bunglon berubah warna, halaman 404 "wrong turn", dan ekspresi sesuai skor. | Tidak perlu diubah. |

**Tidak berlaku** karena tidak ada gestur: manipulasi langsung 1:1, pointer capture, spring dan bounce, velocity handoff, proyeksi momentum, rubber-banding, hysteresis gestur, dan swipe. Kalau nanti skill map dibuat bisa digeser atau di-zoom, bagian ini perlu diterapkan.

## Prioritas perbaikan

| # | Perbaikan | Usaha | Dampak |
|---|---|---|---|
| 1 | `active:` press state di kartu jawaban, kartu karier, dan baris prioritas | ±30 menit | Tinggi di ponsel, tempat sebagian besar mahasiswa membuka aplikasi |
| 2 | Fallback `prefers-reduced-transparency` dan `prefers-contrast` di `globals.css` | ±30 menit | Aksesibilitas |
| 3 | Tracking dan leading judul besar | ±15 menit | Tampilan lebih rapi |
| 4 | Ganti `transition-all` di Button | ±5 menit | Kecil |
| 5 | Px ke rem untuk ukuran teks | ±1–2 jam, bertahap | Aksesibilitas ukuran teks |

## Status perbaikan (17 Okt 2026)

- **1. Press state: selesai.** Kartu jawaban Quick Check sekarang mengecil sedikit dan berubah warna saat ditekan (`active:scale-[0.985]`, 100 ms). Baris prioritas di dashboard berubah warna saat ditekan. Kartu karier di landing tidak perlu diubah karena yang bisa diklik adalah tombol `Button`, dan tombol itu sudah punya `active:translate-y-px`.
- **2. Fallback aksesibilitas: selesai.** `prefers-reduced-transparency` membuat header dan overlay dialog padat tanpa blur. `prefers-contrast: more` menggelapkan teks sekunder dan border.
- **3. Tracking judul: selesai.** `h1` memakai -0.02em dan `h2` -0.01em, lewat `@layer base` di `globals.css`.
- **4. `transition-all`: selesai.** Di `Button` dan `Tabs` diganti dengan daftar properti eksplisit.
- **5. Px ke rem: belum.** Bisa dikerjakan bertahap.
