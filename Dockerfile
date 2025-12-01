# PolyBot Docker Image
# Multi-stage build for smaller image size

FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt


# Production image
FROM python:3.11-slim

# Create non-root user
RUN useradd --create-home --shell /bin/bash polybot

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY src/ ./src/
COPY requirements.txt .

# Set ownership
RUN chown -R polybot:polybot /app

# Switch to non-root user
USER polybot

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8080/health', timeout=5)" || exit 1

# Environment variables (can be overridden)
ENV PYTHONUNBUFFERED=1
ENV DRY_RUN=true

# Run the bot
CMD ["python", "-m", "src.main"]
