# Runbook

## Cadangan dan pemulihan (plan B3)

Layanan `backup` di `docker-compose.yml` menjalankan `deploy/backup.sh`: `pg_dump` harian ke `./backups/pathsync-YYYYMMDD.sql.gz`, disimpan 14 hari. **RPO = 24 jam** (data paling lama yang bisa hilang adalah sejak dump terakhir).

### Memulihkan

```bash
docker compose stop backend market-refresh retention
gunzip -c backups/pathsync-YYYYMMDD.sql.gz | docker compose exec -T db psql -U pathsync -d pathsync -v ON_ERROR_STOP=1
docker compose run --rm backend python -m pathsync.migrate          # dump lama: naikkan ke head
docker compose run --rm backend python -m pathsync.migrate check    # harus: models and migrations match
docker compose start backend market-refresh retention
```

Kueri kontrol setelah pemulihan (bandingkan dengan sebelum insiden atau dengan log dump):

```sql
select (select count(*) from postings), (select count(*) from posting_mentions),
       (select count(*) from market_snapshots), (select count(*) from students),
       (select version_num from alembic_version);
```

### Latihan pemulihan 14 Okt 2026

Dilakukan di PostgreSQL 17 lokal (produksi memakai `postgres:16`; format dump teks sama).

| Langkah | Hasil |
|---|---|
| Database sumber dibangun dari nol (`build_market --ref 2026-10-12`, `expert_study`) | 1.093 posting, 17.818 sebutan, 14 snapshot, 135 peringkat skenario, migrasi 0005 |
| `pg_dump --no-owner --clean --if-exists` lalu gzip | 1,1 MB, kurang dari 1 detik |
| Pulihkan ke database kosong + `pathsync.migrate check` | 3 detik, model dan migrasi cocok |
| Kueri kontrol | identik dengan sumber |
| Seluruh tes backend di database hasil pemulihan | 77 lulus |

**RTO terukur: sekitar 3 detik untuk data saat ini**, ditambah waktu menghentikan dan menyalakan layanan. Dump lama yang dibuat sebelum migrasi terbaru juga diuji: setelah `pathsync.migrate` lalu `check`, hasilnya cocok.

Ulangi latihan ini setiap ada migrasi baru dan sebelum final.

## Retensi data (plan B3)

`python -m pathsync.retention` (layanan `retention`, harian) menghapus data yang lewat masa simpan. Angkanya satu sumber di `backend/pathsync/retention.py` dan dikutip apa adanya di halaman Privacy (dicek `tests/test_retention.py`).

| Data | Masa simpan |
|---|---|
| Profil yang tidak dipakai | 24 bulan sejak terakhir aktif, lalu dihapus beserta semua data terkait |
| Catatan pemakaian (`product_events`) | 365 hari |
| Catatan tindakan staf (`audit_log`) | 730 hari |
| Sesi asesmen yang tidak dikirim | 7 hari setelah kedaluwarsa |
| Token staf yang dicabut atau kedaluwarsa | 90 hari |
| Cadangan basis data | 14 hari |

"Delete My Profile" dan penghapusan otomatis memakai fungsi yang sama (`erase_student`), termasuk `product_events` milik mahasiswa itu.

## Pindah dari SQLite ke PostgreSQL

```bash
python -m pipeline.sqlite_to_postgres sqlite:///data/pathsync.db postgresql+psycopg://user:pw@host/db
```

Target harus kosong. Skrip menaikkan migrasi, menyalin semua tabel urut foreign key, memajukan sequence id, lalu membandingkan jumlah baris.

## Pemantauan (plan C4)

Satu perintah untuk melihat kondisi server:

```bash
curl -s -H "Authorization: Bearer $PATHSYNC_ADMIN_TOKEN" https://<domain>/api/admin/runtime
```

Isinya: p50/p95/maks dan tingkat galat per rute (dikelompokkan per pola rute, jadi id mahasiswa tidak memecah statistik), kesehatan database, umur snapshot pasar, dan daftar `alerts`. Peringatan muncul bila database tidak terjangkau, snapshot pasar lebih tua dari 45 hari, p95 suatu rute di atas 1 detik, atau tingkat galat di atas 1% (minimal 20 permintaan). Statistik disimpan per proses worker; `worker_pid` menunjukkan worker mana yang menjawab.

- `/api/health` dipakai healthcheck container: 503 hanya bila database mati; snapshot yang basi dilaporkan lewat `market_stale` tanpa membuat layanan dianggap mati.
- Di produksi (`PATHSYNC_ENV=production`) setiap baris log berupa JSON dengan `rid` (request id yang sama dengan header `X-Request-ID` di respons dan pesan galat), metode, path, status, dan durasi. Isi permintaan dan token tidak pernah dicatat.
- Galat dikirim ke Sentry bila `SENTRY_DSN` diisi di `.env` (tanpa data pribadi).
