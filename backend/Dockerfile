FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 HF_HOME=/app/.hf
# CPU-only torch keeps the image ~2 GB smaller than the default CUDA wheel
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt "psycopg[binary]>=3.2"
COPY . .
EXPOSE 8000
CMD ["sh", "docker-entrypoint.sh"]
