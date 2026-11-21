# Agent service (UAAP). Listens on 8090.
FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir .

RUN useradd --create-home --uid 10001 app
USER app

EXPOSE 8090
CMD ["python", "-m", "uvicorn", "uaap.api.main:app", "--host", "0.0.0.0", "--port", "8090"]
