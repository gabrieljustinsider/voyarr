############################
# Stage 1 — Build
# Compile all C-extension wheels (psycopg2, face-recognition, opencv, etc.)
# build-essential and libpq-dev are only needed here, not in the final image.
############################
FROM python:3.14-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

############################
# Stage 2 — Runtime
# Only copy compiled wheels + install ffmpeg (runtime-only, no compiler needed)
############################
FROM python:3.14-slim-bookworm

LABEL version="1.148.0"
LABEL org.opencontainers.image.version="1.148.0"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ffmpeg is strictly required for FFmpeg/Mutagen perceptual hashing (phash)
# libpq5 is the runtime-only postgres client lib (no compiler needed)
# libgomp1 is required by opencv/face_recognition at runtime
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    ffmpeg \
    libpq5 \
    postgresql-client \
    libgomp1 \
    libopenblas0 \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled Python packages from builder
COPY --from=builder /install /usr/local

COPY . .

EXPOSE 8000
CMD ["python", "run.py"]