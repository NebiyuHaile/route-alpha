FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN addgroup --system routealpha && adduser --system --ingroup routealpha routealpha

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN chown -R routealpha:routealpha /app
USER routealpha

EXPOSE 8000

# Run Alembic from a controlled release environment before starting this container.
# Render Free does not support release/pre-deploy jobs, so use the documented
# one-time local migration command against the production database.
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips \"${FORWARDED_ALLOW_IPS:-127.0.0.1}\""]
