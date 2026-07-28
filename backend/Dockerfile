FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Copy application and assign ownership
COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "60", "app:create_app()"]
