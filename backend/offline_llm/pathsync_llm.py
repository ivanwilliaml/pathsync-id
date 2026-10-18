# PathSync - offline LLM run on a Kaggle GPU (template; build with backend/offline_llm/build_kernel.py).
#
# Runs an open-weight instruction model (Qwen3, Apache-2.0, attached as a Kaggle Model, no internet
# needed) on a PathSync job file: skill extraction from job postings, or the "generic LLM" ranking
# baseline for the expert scenarios. Prompts and the output schema come from the job file, which is
# exported from the backend so they are identical to the Claude path. The output is raw model JSON;
# quote verification and taxonomy normalisation happen back in the backend (pipeline/llm_jobs.py).
import base64
import glob
import gzip
import json
import os
import re
import time
from datetime import datetime

import os as _os
_os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

JOBS_B64 = "__JOBS__"
jobs = json.loads(gzip.decompress(base64.b64decode(JOBS_B64)).decode("utf-8"))
KIND = jobs["kind"]
print(f"job: {KIND}, {len(jobs['items'])} item")

# ------------------------------------------------------------------ model
n_gpu = torch.cuda.device_count()
vram = sum(torch.cuda.get_device_properties(i).total_memory for i in range(n_gpu)) / 2**30
print(f"GPU: {n_gpu} x {[torch.cuda.get_device_name(i) for i in range(n_gpu)]}, total {vram:.1f} GiB")


def find_model(size: str) -> str | None:
    for cfg in glob.glob(f"/kaggle/input/**/{size}/**/config.json", recursive=True):
        return os.path.dirname(cfg)
    return None


# 8B in fp16 needs ~17 GiB of weights -> only on 2 x T4 (30 GiB); otherwise fall back to 4B
MODEL_DIR = (find_model("8b") if vram >= 28 else None) or find_model("4b") or find_model("8b")
assert MODEL_DIR, "model Qwen3 tidak ditemukan di /kaggle/input"
MODEL_NAME = "qwen3-" + ("8b" if "/8b" in MODEL_DIR else "4b")
print("model:", MODEL_DIR)

tok = AutoTokenizer.from_pretrained(MODEL_DIR)
tok.padding_side = "left"
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
model = AutoModelForCausalLM.from_pretrained(MODEL_DIR, torch_dtype=torch.float16, device_map="auto")
model.eval()

SCHEMA_HINT = ("\n\nJawab HANYA dengan satu objek JSON yang valid sesuai skema berikut, tanpa teks lain dan tanpa blok kode:\n"
               + json.dumps(jobs["schema"], ensure_ascii=False))


def prompt(item: dict) -> str:
    user = jobs["user_prefix"] + item["text"]
    msgs = [{"role": "system", "content": jobs["system"] + SCHEMA_HINT}, {"role": "user", "content": user}]
    try:
        return tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    except TypeError:
        return tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)


def parse(text: str):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    a, b = text.find("{"), text.rfind("}")
    if a == -1 or b <= a:
        raise ValueError("tidak ada objek JSON")
    return json.loads(text[a:b + 1])


def generate(batch: list[dict], max_new: int, sample: bool) -> list[str]:
    # long postings in one batch can exhaust a 16 GB T4: retry one at a time, then mark as failed
    try:
        return _generate(batch, max_new, sample)
    except torch.OutOfMemoryError:
        torch.cuda.empty_cache()
        if len(batch) > 1:
            return [t for it in batch for t in generate([it], max_new, sample)]
        return ["OOM"]


@torch.no_grad()
def _generate(batch: list[dict], max_new: int, sample: bool) -> list[str]:
    enc = tok([prompt(it) for it in batch], return_tensors="pt", padding=True).to(model.device)
    kw = dict(max_new_tokens=max_new, pad_token_id=tok.pad_token_id)
    kw.update(dict(do_sample=True, temperature=0.3, top_p=0.9) if sample else dict(do_sample=False))
    out = model.generate(**enc, **kw)
    return tok.batch_decode(out[:, enc["input_ids"].shape[1]:], skip_special_tokens=True)


MAX_NEW = 2048 if KIND == "postings" else 512
BATCH = (4 if n_gpu >= 2 else 2) if KIND == "postings" else 8
items = sorted(jobs["items"], key=lambda it: len(it["text"]))      # similar lengths batch together
key = "fingerprint" if KIND == "postings" else "id"
results: dict[str, dict] = {}
t0 = time.time()
# Kaggle stops a session at 12 h and keeps nothing; stop ourselves before that and always leave a results file
TIME_BUDGET_S = float(os.getenv("PATHSYNC_TIME_BUDGET_H", "11")) * 3600
path = f"/kaggle/working/llm_results_{KIND}.json"


def save(final: bool) -> None:
    out = {"kind": KIND, "model": MODEL_NAME, "generated_at": datetime.now().isoformat(timespec="seconds"),
           "taxonomy_version": jobs.get("taxonomy_version"), "complete": final and len(results) == len(items),
           "results": results}
    with open(path + ".tmp", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    os.replace(path + ".tmp", path)


for i in range(0, len(items), BATCH):
    if time.time() - t0 > TIME_BUDGET_S:
        print(f"batas waktu tercapai setelah {len(results)} item; hasil sebagian disimpan", flush=True)
        break
    batch = items[i:i + BATCH]
    texts = generate(batch, MAX_NEW, sample=False)
    for it, txt in zip(batch, texts):
        try:
            results[it[key]] = parse(txt)
        except Exception as e:
            results[it[key]] = {"error": str(e), "raw": txt[-2000:]}
    # one retry with light sampling for anything that did not parse
    retry = [it for it in batch if "error" in results[it[key]]]
    if retry:
        for it, txt in zip(retry, generate(retry, MAX_NEW, sample=True)):
            try:
                results[it[key]] = parse(txt)
            except Exception as e:
                results[it[key]]["retry_error"] = str(e)
    if KIND == "scenarios":
        for it in batch:
            results[it[key]]["fingerprint"] = it.get("fingerprint")
    done = min(i + BATCH, len(items))
    print(f"{done}/{len(items)} selesai, {time.time() - t0:.0f} dtk, gagal {sum('error' in r for r in results.values())}", flush=True)
    save(final=False)

save(final=True)
print("ditulis:", path, "| item:", len(results), "dari", len(items), "| gagal:", sum("error" in r for r in results.values()),
      "| waktu:", round(time.time() - t0), "dtk")
