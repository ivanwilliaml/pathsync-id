"""Download the open "Dataset Pasar Kerja" files from Pusat Pasar Kerja Kemnaker.

Paper Table 5: aggregate number of vacancies per KBJI major group, 2022-2024, used
only as trend context (it contains no description text).
"""
from __future__ import annotations

from .common import RAW_DIR, PoliteClient

FILES = [
    "Lowongan_Kerja_di_Karirhub_Menurut_Golongan_Pokok_Jabatan_Tahun_2022-2024.csv",
    "Lowongan_Kerja_Menurut_Kategori_Lapangan_Usaha_Tahun_2022-2024.csv",
    "Lowongan_Kerja_Menurut_Persyaratan_Pendidikan_Tahun_2022-2024.csv",
]
BASE = "https://paskerid.kemnaker.go.id/documents/"


def main():
    client = PoliteClient(min_interval=0.5)
    out_dir = RAW_DIR / "kemnaker"
    out_dir.mkdir(exist_ok=True)
    for name in FILES:
        r = client.get(BASE + name)
        if r is None or r.status_code != 200:
            print(f"[kemnaker] failed {name}")
            continue
        (out_dir / name).write_bytes(r.content)
        print(f"[kemnaker] saved {name} ({len(r.content)} bytes)")
    client.close()


if __name__ == "__main__":
    main()
