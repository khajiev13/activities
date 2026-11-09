FROM ghcr.io/astral-sh/uv:0.13.7 AS uv
FROM python:3.13-slim-trixie

COPY --from=uv /uv /uvx /bin/
ARG APP_UID=1000
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
RUN useradd --uid "$APP_UID" --create-home app \
    && mkdir -p /data/auth \
    && chown app:app /data/auth
COPY --chown=app:app . /app
RUN chmod 755 /app/entrypoint.sh \
    && cp /app/entrypoint.sh /usr/local/bin/eventopia-entrypoint
USER app
ENTRYPOINT ["eventopia-entrypoint"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
