"""Build the small-host embedding model (PATHSYNC_EMBED_BACKEND=onnx) from the published float32 ONNX export.

    python scripts/quantize_onnx.py /app/model/model_emb8.onnx

1. Keep only the token-embedding rows of Latin-script SentencePiece pieces (115k of 250k; Indonesian and English text
   uses no others) plus the four special tokens, which keep ids 0-3 because XLM-R derives position ids from the pad
   id (1). Writes <out>.ids.npy, the old -> new id map (dropped pieces map to <unk>), and copies the SentencePiece
   model next to <out>.
2. Quantize that table to int8; the transformer layers stay float32 (a fully int8 model moved the nearest skill for
   18% of the labelled phrases).

Runs at image build time and needs the `onnx` package, which the running service does not.
"""
import os
import shutil
import sys
import unicodedata

import numpy as np
import onnx
import sentencepiece as spm
from huggingface_hub import hf_hub_download
from onnx import numpy_helper
from onnxruntime.quantization import QuantType, quantize_dynamic

MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
TABLE = "embeddings.word_embeddings.weight"


def latin(piece: str) -> bool:
    for ch in piece.replace("▁", ""):
        if ch.isascii() or "LATIN" in unicodedata.name(ch, "") or unicodedata.category(ch)[0] in "PSNZ":
            continue
        return False
    return True


def main(out: str) -> None:
    sp_file = hf_hub_download(MODEL, "sentencepiece.bpe.model")
    shutil.copy(sp_file, os.path.join(os.path.dirname(os.path.abspath(out)), "sentencepiece.bpe.model"))
    sp = spm.SentencePieceProcessor(model_file=sp_file)
    m = onnx.load(hf_hub_download(MODEL, "onnx/model.onnx"))
    init = next(i for i in m.graph.initializer if i.name == TABLE)
    table = numpy_helper.to_array(init)
    keep = [0, 1, 2, 3] + [i + 1 for i in range(sp.get_piece_size()) if i > 2 and latin(sp.id_to_piece(i))]
    remap = np.full(table.shape[0], 3, dtype=np.int32)          # dropped -> <unk>
    remap[keep] = np.arange(len(keep), dtype=np.int32)
    init.CopyFrom(numpy_helper.from_array(table[keep], TABLE))
    tmp = out + ".f32.onnx"
    onnx.save(m, tmp)
    quantize_dynamic(tmp, out, op_types_to_quantize=["Gather"], weight_type=QuantType.QUInt8)
    np.save(out + ".ids.npy", remap)
    os.remove(tmp)
    print(f"wrote {out}: {len(keep)} of {table.shape[0]} token rows")


if __name__ == "__main__":
    main(sys.argv[1])
