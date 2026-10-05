"""Claude-backed components. The LLM is used only where language understanding is
needed (paper III.B): reading job postings, reading CVs, rating project artifacts
against the rubric, and the "generic LLM" ranking baseline used in evaluation.

Priority decisions are never made here - they come from the trained ranking model.

Credentials are resolved by the Anthropic SDK (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN
or an `ant auth login` profile). Set PATHSYNC_EXTRACTOR=llm to force this backend.
"""
from __future__ import annotations

import json
import os

from ..config import LLM_MODEL
from ..taxonomy import Skill
from .base import Mention

FALLBACK_BETA = "server-side-fallback-2026-07-01"


def llm_configured() -> bool:
    mode = os.getenv("PATHSYNC_EXTRACTOR", "auto").lower()
    if mode == "lexicon":
        return False
    if mode == "llm":
        return True
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))


class LLMUnavailable(RuntimeError):
    pass


class ClaudeClient:
    def __init__(self, model: str | None = None):
        try:
            import anthropic
        except ImportError as e:  # pragma: no cover
            raise LLMUnavailable("anthropic SDK not installed") from e
        self._anthropic = anthropic
        self.client = anthropic.Anthropic()
        self.model = model or LLM_MODEL

    def json_call(self, system: str, user: str, schema: dict, effort: str = "low", max_tokens: int = 8000) -> dict:
        a = self._anthropic
        try:
            resp = self.client.beta.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                betas=[FALLBACK_BETA],
                fallbacks="default",
                system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": user}],
                output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
            )
        except a.AuthenticationError as e:
            raise LLMUnavailable("Anthropic credentials missing or invalid") from e
        except a.RateLimitError as e:
            raise LLMUnavailable("rate limited by the Anthropic API; retry later") from e
        except a.APIStatusError as e:
            raise LLMUnavailable(f"Anthropic API error {e.status_code}: {e.message}") from e
        except a.APIConnectionError as e:
            raise LLMUnavailable("cannot reach the Anthropic API") from e
        if resp.stop_reason == "refusal":
            raise LLMUnavailable("request declined by the model")
        if resp.stop_reason == "max_tokens":
            raise LLMUnavailable("response truncated (max_tokens)")
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return json.loads(text)


def _taxonomy_block(skills: dict[str, Skill]) -> str:
    lines = [f"- {s.id}: {s.name_id or s.name} ({s.name_en}) - {s.description_id or s.description}" for s in skills.values()]
    return "\n".join(lines)


POSTING_SYSTEM = """Kamu adalah pengekstraksi keterampilan untuk sistem PathSync. Tugasmu membaca teks lowongan kerja (bahasa Indonesia atau Inggris) dan mendaftar keterampilan yang DITUNTUT lowongan itu.

Aturan:
1. Pilih skill_id HANYA dari taksonomi di bawah. Bila lowongan menuntut keterampilan penting yang tidak ada di taksonomi, pakai skill_id "NEW" dan tulis namanya di "surface".
2. "quote" wajib disalin persis kata demi kata dari teks lowongan (satu kalimat atau butir yang memuat bukti). Jangan menerjemahkan, meringkas, atau memperbaiki ejaan. Keluaran yang kutipannya tidak ditemukan akan ditolak sistem.
3. "surface" adalah frasa keterampilan sebagaimana ditulis lowongan.
4. "level" adalah tingkat yang diminta: "dasar" (familiar, memahami, basic), "mandiri" (mampu, berpengalaman, proficient), atau "mahir" (advanced, expert, menguasai secara mendalam).
5. Abaikan deskripsi perusahaan, benefit, gaji, dan syarat administratif. Keterampilan implisit dalam tanggung jawab (mis. "menyusun BRD") tetap dihitung.
6. Satu skill_id cukup muncul sekali, pilih kutipan terkuat.

Taksonomi:
{taxonomy}"""

CV_SYSTEM = """Kamu membaca CV mahasiswa untuk sistem PathSync dan mendaftar keterampilan yang DIKLAIM pemilik CV. Klaim CV bukan bukti penguasaan; sistem hanya memakainya untuk konfirmasi.

Aturan sama dengan ekstraksi lowongan: skill_id hanya dari taksonomi (atau "NEW"), "quote" disalin persis dari CV, "level" adalah tingkat yang diklaim.

Taksonomi:
{taxonomy}"""

RUBRIC_SYSTEM = """Kamu menilai artefak proyek mahasiswa (laporan analisis, notebook, kueri, dokumen kebutuhan, repositori) untuk sistem PathSync dengan rubrik empat tingkat per keterampilan:
0 = tidak tampak, 1 = dasar, 2 = mandiri, 3 = mahir.

Aturan:
1. Nilai hanya keterampilan pada daftar kandidat.
2. Untuk tingkat 1-3 wajib sertakan "quote" yang disalin persis dari artefak sebagai bukti. Bila tidak ada bukti, beri tingkat 0 dan quote kosong.
3. Nilai apa yang benar-benar diperlihatkan artefak, bukan apa yang diklaim.
4. "rationale" satu kalimat bahasa Indonesia.

Definisi kandidat:
{taxonomy}"""


def _mention_schema(skill_ids: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {
            "skills": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "skill_id": {"type": "string", "enum": skill_ids + ["NEW"]},
                        "surface": {"type": "string"},
                        "quote": {"type": "string"},
                        "level": {"type": "string", "enum": ["dasar", "mandiri", "mahir"]},
                    },
                    "required": ["skill_id", "surface", "quote", "level"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["skills"],
        "additionalProperties": False,
    }


class ClaudeExtractor:
    name = "llm"

    def __init__(self, skills: dict[str, Skill], model: str | None = None):
        self.skills = skills
        self.client = ClaudeClient(model)
        tax = _taxonomy_block(skills)
        self.posting_system = POSTING_SYSTEM.format(taxonomy=tax)
        self.cv_system = CV_SYSTEM.format(taxonomy=tax)
        self.schema = _mention_schema(list(skills))

    def _to_mentions(self, data: dict) -> list[Mention]:
        out = []
        for it in data.get("skills", []):
            sid = it["skill_id"] if it["skill_id"] != "NEW" else None
            out.append(Mention(surface=it["surface"], quote=it["quote"], level=it["level"], skill_id=sid,
                               similarity=1.0 if sid else 0.0, status="auto" if sid else "pending", method="llm"))
        return out

    def extract(self, text: str) -> list[Mention]:
        return self._to_mentions(self.client.json_call(self.posting_system, f"Teks lowongan:\n\n{text}", self.schema))

    def extract_cv(self, text: str) -> list[Mention]:
        return self._to_mentions(self.client.json_call(self.cv_system, f"Teks CV:\n\n{text}", self.schema))

    def rate_project(self, text: str, candidate_ids: list[str]) -> list[dict]:
        cands = {k: self.skills[k] for k in candidate_ids if k in self.skills}
        schema = {
            "type": "object",
            "properties": {"ratings": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "skill_id": {"type": "string", "enum": list(cands)},
                    "level": {"type": "integer", "enum": [0, 1, 2, 3]},
                    "quote": {"type": "string"},
                    "rationale": {"type": "string"},
                },
                "required": ["skill_id", "level", "quote", "rationale"],
                "additionalProperties": False}}},
            "required": ["ratings"],
            "additionalProperties": False,
        }
        system = RUBRIC_SYSTEM.format(taxonomy=_taxonomy_block(cands))
        return self.client.json_call(system, f"Artefak proyek:\n\n{text[:60000]}", schema, effort="medium")["ratings"]

    def generic_ranking(self, scenario_text: str, candidate_ids: list[str]) -> list[str]:
        """Evaluation baseline 4: a general LLM recommendation with no taxonomy weights or graph."""
        schema = {"type": "object", "properties": {"order": {"type": "array", "items": {"type": "string", "enum": candidate_ids}}},
                  "required": ["order"], "additionalProperties": False}
        system = ("Kamu konselor karier. Urutkan keterampilan kandidat dari yang paling perlu dipelajari lebih dahulu "
                  "oleh mahasiswa ini untuk peran target. Jawab dengan seluruh kandidat dalam urutan.")
        order = self.client.json_call(system, scenario_text, schema)["order"]
        seen = []
        for s in order + candidate_ids:
            if s not in seen:
                seen.append(s)
        return seen
