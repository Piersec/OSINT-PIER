FROM golang:1.26-bookworm AS tools

ARG SUBFINDER_VERSION=v2.16.0
ARG KATANA_VERSION=v1.7.0
ARG GOBUSTER_VERSION=v3.8.2

ENV CGO_ENABLED=0
ENV GOTOOLCHAIN=local
# Keep the build reproducible on small Docker Desktop installations.
ENV GOMAXPROCS=2
ENV GOFLAGS=-p=1

RUN go install -trimpath -ldflags='-s -w' github.com/projectdiscovery/subfinder/v2/cmd/subfinder@${SUBFINDER_VERSION} \
    && go install -trimpath -ldflags='-s -w' github.com/projectdiscovery/katana/cmd/katana@${KATANA_VERSION} \
    && go install -trimpath -ldflags='-s -w' github.com/OJ/gobuster/v3@${GOBUSTER_VERSION}

FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOME=/tmp

RUN apt-get update \
    && apt-get install --no-install-recommends -y nmap ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home-dir /tmp --no-create-home commandrunner \
    && mkdir -p /app/wordlists /tmp/config \
    && chown -R commandrunner:commandrunner /app /tmp/config

COPY --from=tools /go/bin/subfinder /usr/local/bin/subfinder
COPY --from=tools /go/bin/katana /usr/local/bin/katana
COPY --from=tools /go/bin/gobuster /usr/local/bin/gobuster
COPY runner.py /app/runner.py
COPY wordlists/common.txt /app/wordlists/common.txt

WORKDIR /app
USER commandrunner
EXPOSE 8081
CMD ["python", "runner.py"]
