# Hugging Face Spaces variant of backend/Dockerfile: Spaces run the container as uid 1000.
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 HF_HOME=/app/.hf PIP_NO_CACHE_DIR=1
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install -r requirements.txt "psycopg[binary]>=3.2"
RUN useradd --create-home --uid 1000 user
COPY --chown=user . .
RUN mkdir -p /app/.hf && chown -R user:user /app
USER user
# download the embedding model at build time so the first request does not wait for it
RUN python -c "from sentence_transformers import SentenceTransformer as S; S('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"
EXPOSE 8000
CMD ["sh", "docker-entrypoint.sh"]
