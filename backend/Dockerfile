FROM python:3.11-slim-bullseye

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers and system dependencies
RUN python -m playwright install chromium
RUN python -m playwright install-deps chromium

# Copy the rest of the application
COPY . .

# Expose port (Documentation only, overwritten by -p or docker-compose)
EXPOSE 8000

# Run the application via the port-aware wrapper
CMD ["python3", "run.py"]