"""PathSync core package."""
import sys

if sys.platform == "win32":
    # Windows only: torch must load its OpenMP/MKL DLLs before scipy and scikit-learn load theirs. In the other order
    # the process later dies with an access violation (seen in the test suite once data/processed/embedding_cache.sqlite
    # exists, because cached embeddings mean the model, and so torch, is never imported before scipy runs).
    try:
        import torch  # noqa: F401
    except ImportError:
        pass
