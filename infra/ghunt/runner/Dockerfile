FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOME=/data

RUN pip install --no-cache-dir ghunt==2.3.4 \
    && useradd --system --uid 10001 --home-dir /data --create-home ghunt \
    && mkdir -p /data/.malfrats/ghunt \
    && chown -R ghunt:ghunt /data

WORKDIR /app
COPY runner.py ./runner.py

USER ghunt
EXPOSE 8081
CMD ["python", "runner.py"]
