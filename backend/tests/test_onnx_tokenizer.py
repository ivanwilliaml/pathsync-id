"""The small-host embedding backend tokenises with SentencePiece; ids must equal the reference tokenizer.json."""

import pytest

pytest.importorskip("sentencepiece")
tokenizers = pytest.importorskip("tokenizers")


def test_sentencepiece_ids_match_tokenizer_json():
    from huggingface_hub import hf_hub_download

    from pathsync.config import EMBEDDING_MODEL
    from pathsync.embeddings import _OnnxModel
    try:
        fast = tokenizers.Tokenizer.from_file(hf_hub_download(EMBEDDING_MODEL, "tokenizer.json"))
        sp_file = hf_hub_download(EMBEDDING_MODEL, "sentencepiece.bpe.model")
    except Exception:
        pytest.skip("model files not in the local Hugging Face cache")
    import sentencepiece as spm

    m = _OnnxModel.__new__(_OnnxModel)
    m.sp, m.remap = spm.SentencePieceProcessor(model_file=sp_file), None
    for text in ["Business Requirement Document (BRD)", "menyusun user story dan BPMN", "SQL, Power BI & Excel",
                 "Kemampuan analisis data penjualan", "L’Oréal — supply chain"]:
        assert m._ids(text) == fast.encode(text).ids
    long = m._ids("analisis " * 300)
    assert len(long) == _OnnxModel.MAX_TOKENS and long[0] == 0 and long[-1] == 2
