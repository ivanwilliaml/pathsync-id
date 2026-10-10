FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 HF_HOME=/app/.hf PIP_NO_CACHE_DIR=1
# CPU-only torch keeps the image ~2 GB smaller than the default CUDA wheel
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install -r requirements.txt "psycopg[binary]>=3.2"
COPY . .
# run as an unprivileged user; the embedding cache and generated files live in writable dirs
RUN useradd --create-home --uid 10001 pathsync && mkdir -p /app/.hf && chown -R pathsync:pathsync /app
USER pathsync
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"
CMD ["sh", "docker-entrypoint.sh"]
