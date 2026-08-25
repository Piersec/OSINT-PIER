FROM python:3.13-alpine

WORKDIR /app
COPY gateway.py ./gateway.py

ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV COMMAND_TOOLS_UPSTREAM=http://runner:8081

RUN adduser -D -u 10001 gateway
USER gateway
EXPOSE 8080
CMD ["python", "gateway.py"]
