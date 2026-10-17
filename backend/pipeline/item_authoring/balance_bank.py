"""Balance where the key sits in the option-length ranking for one bank file, in both languages.

    python -m pipeline.item_authoring.balance_bank x_bisnis            (both languages)
    python -m pipeline.item_authoring.balance_bank x_backend --lang id  (one language only)
    then python -m pipeline.item_cue_audit

Same idea as balance_lengths.py (which works on the _rewrite files): each item gets a target length rank for its key
(0 = longest .. 3 = shortest), assigned from a hash of the item id so the ranks are balanced over the file and carry no
information about the content. Options are then nudged with short neutral phrases until the key sits at that rank: the
key is padded to move up, the distractors that must end up longer than the key are padded to move down. The option that
receives a phrase is chosen by the target rank, never by correctness. Indonesian (items/) and English (items_en/) are
balanced separately because translation changes lengths. Options that look like code are left alone. Phrases already
added by an earlier run are stripped first, so the script is idempotent.
"""
from __future__ import annotations

import hashlib
import json
import random
import re
import sys

from pathsync.config import SEED_DIR

# neutral phrases: no hedge words (usually, generally, umumnya ...) and no absolutes, which item_audit treats as cues
FILL = {
    "id": [" dalam praktik sehari-hari", " di lingkungan kerja", " sebagai langkah rutin", " pada tahap awal",
           " dalam konteks perusahaan", " untuk kebutuhan tim", " dalam proses kerja", " di tingkat operasional"],
    "en": [" in day-to-day practice", " in the workplace", " as a routine step", " at an early stage",
           " in a company setting", " for the team's needs", " within the work process", " at the operational level"],
}
# phrases added by earlier balancers (add_business_roles._balance), stripped before re-balancing
OLD_FILL = {
    "id": [" pada kebanyakan organisasi", " menurut kebiasaan umum", " dalam banyak kasus", " pada umumnya"],
    "en": [" in most organisations", " by common habit", " in many cases", " in general"],
}
CODEISH = re.compile(r"[=<>{}();_\\]|--|@")
MIN_LEN = 14
MAX_PHRASES = 1


def _strip(text: str, fillers: list[str]) -> str:
    rx = re.compile("(" + "|".join(re.escape(f) for f in fillers) + ")+$")
    return rx.sub("", text)


def _target_rank(item_id: str, salt: str) -> int:
    return int(hashlib.sha1(f"{salt}|{item_id}".encode()).hexdigest(), 16) % 4


def _pad_past(text: str, beat: int, fillers: list[str], rng: random.Random) -> str | None:
    out = text
    for _ in range(MAX_PHRASES):
        if len(out) > beat:
            return out
        out += rng.choice(fillers)
    return out if len(out) > beat else None


def balance(item_id: str, options: list[str], lang: str) -> list[str]:
    """options[0] is the key."""
    fillers = FILL[lang]
    opts = [_strip(o, fillers + OLD_FILL[lang]) for o in options]
    if len(opts) != 4 or any(len(o) < MIN_LEN or CODEISH.search(o) for o in opts):
        return opts
    rng = random.Random(f"{lang}|{item_id}")
    target = _target_rank(item_id, lang)                  # number of distractors that must be longer than the key
    others = sorted(range(1, 4), key=lambda j: -len(opts[j]))
    longer = [j for j in others if len(opts[j]) > len(opts[0])]
    if len(longer) > target:
        # key too short: pad it past the distractors that should end up shorter than it
        beat = len(opts[others[target]])
        padded = _pad_past(opts[0], beat, fillers, rng)
        if padded is not None:
            opts[0] = padded
    elif len(longer) < target:
        # key too long: pad the longest of the shorter distractors until `target` of them are longer than the key
        for j in [k for k in others if k not in longer][: target - len(longer)]:
            padded = _pad_past(opts[j], len(opts[0]), fillers, rng)
            if padded is not None:
                opts[j] = padded
    return opts


def main() -> None:
    args = sys.argv[1:]
    langs = ("id", "en")
    if "--lang" in args:
        langs = (args[args.index("--lang") + 1],)
        args = [a for a in args if a not in ("--lang", *langs)]
    stem = args[0] if args else "x_bisnis"
    base_path, en_path = SEED_DIR / "items" / f"{stem}.json", SEED_DIR / "items_en" / f"{stem}.json"
    base = json.loads(base_path.read_text(encoding="utf-8"))
    en = json.loads(en_path.read_text(encoding="utf-8")) if en_path.exists() else {}
    changed = 0
    for it in base:
        if "id" in langs:
            new = balance(it["id"], it["options"], "id")
            changed += new != it["options"]
            it["options"] = new
        if "en" in langs and it["id"] in en:
            new_en = balance(it["id"], en[it["id"]]["options"], "en")
            changed += new_en != en[it["id"]]["options"]
            en[it["id"]]["options"] = new_en
    # keep the bank files' compact layout (one item per line) so diffs stay readable
    if "id" in langs:
        body = ",\n".join(" " + json.dumps(it, ensure_ascii=False, separators=(",", ":")) for it in base)
        base_path.write_text("[\n" + body + "\n]\n", encoding="utf-8")
    if en and "en" in langs:
        body = ",\n".join(f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in en.items())
        en_path.write_text("{\n" + body + "\n}\n", encoding="utf-8")
    print(f"{stem}: {changed} option lists changed; run python -m pipeline.item_cue_audit")


if __name__ == "__main__":
    main()
