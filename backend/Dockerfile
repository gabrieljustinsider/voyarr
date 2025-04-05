FROM python:3.11-slim

# Set environment variables for Python runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
# ffmpeg is strictly required for FFmpeg/Mutagen perceptual hashing (phash)
# build-essential and libpq-dev are needed to compile psycopg2-binary
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python modules and wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the FastAPI port and set the launch command
EXPOSE 8000
CMD ["python", "run.py"]