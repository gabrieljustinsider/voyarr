# Jizzarr

Jizzarr is a self-hosted media downloader and metadata scraper platform. It includes a FastAPI backend, PostgreSQL database support, and a React/Vite frontend.

## Architecture

- `backend/` - FastAPI application with database models, credential encryption, and REST API endpoints.
- `frontend/` - React application built with Vite for managing providers, credentials, and download queue interaction.
- `docker-compose.yml` - Orchestrates PostgreSQL, backend, and frontend services.
- `init.sql` - Database schema for providers, site recipes, encrypted credentials, media metadata, local files, download queue, and filters.

## Features

### Backend

- FastAPI REST API with CORS support.
- PostgreSQL support via SQLAlchemy.
- Encrypted credential storage using `cryptography.Fernet`.
- Database models for:
  - Providers
  - Site recipes
  - Encrypted credentials
  - Media entries and metadata
  - Local file tracking
  - Download queue management
  - Filters and auto-queue rules
- Basic API endpoints:
  - `GET /` - health check
  - `POST /credentials` - save provider credentials (encrypted)
  - `GET /credentials/{provider_id}` - retrieves and decrypts provider credentials
  - `GET /progress/{task_id}` - progress streaming endpoint for download queue

### Frontend

- React UI using Vite and ESLint.
- Provider list display and API integration.
- Credential capture form for provider authentication.
- Download queue progress view.
- Designed for future integration with the backend API.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

## Environment Variables

The application uses the following variables. Most are optional when using `docker-compose.yml`, because default values are provided.

- `POSTGRES_DB` - PostgreSQL database name (default: `jizzarr`)
- `POSTGRES_USER` - PostgreSQL username (default: `jizzarr_user`)
- `POSTGRES_PASSWORD` - PostgreSQL password (default: `jizzarr_password`)
- `POSTGRES_PORT` - PostgreSQL port (default: `5432`)
- `DATABASE_URL` - Full database connection string (overrides individual vars)
- `MEDIA_ROOT` - Host path to store downloaded media (default: `./media`)
- `MASTER_KEY` - Encryption key used by the backend to encrypt credentials
- `THEPORNDB_API_KEY` - External API key for ThePornDB integration
- `STASHDB_API_KEY` - External API key for StashDB integration
- `STASH_URL` - StashDB service URL
- `EXTENSION_SECRET` - Extension secret token for browser/extension integration
- `SECRET_KEY` - App secret key for future use
- `HOST` - Backend bind host (default: `0.0.0.0`)
- `PORT` - Backend port (default: `8000`)
- `CORS_ORIGINS` - Allowed origins for frontend requests (default: `http://localhost:3000`)

## Initial Setup with Docker

1. Copy the provided `.env.example` file to `.env` and fill in your values:

```bash
cp .env.example .env
```

Then open `.env` and update any required secrets and API keys.

2. Start the stack:

```bash
docker compose up --build
```

3. Access the services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- FastAPI docs: `http://localhost:8000/docs`

## Local Development

If you deploy with Docker Compose, the backend and frontend dependency installation and build steps are already handled automatically when the containers are built. These local development steps are only required when you want to run the services outside of Docker.

### Backend

1. Create and activate a Python virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Run the backend locally:

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

4. Verify the backend is reachable at `http://localhost:8000`.

### Frontend

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start the Vite dev server:

```bash
npm run dev
```

3. Visit `http://localhost:5173` (or the address shown in the terminal).

## Database Initialization

The PostgreSQL container initializes using `init.sql` mounted into `/docker-entrypoint-initdb.d/`. The backend also calls SQLAlchemy `Base.metadata.create_all()` on startup to ensure tables exist.

## Notes

- Provider management, scraping, download queue processing, and metadata extraction are designed in the schema but need further implementation.

## Project Structure

```
/                 # Root project
  docker-compose.yml
  init.sql
  README.md
  backend/         # FastAPI backend service
    Dockerfile
    main.py
    models.py
    requirements.txt
  frontend/        # React/Vite frontend service
    Dockerfile
    package.json
    src/
      App.jsx
      main.jsx
```

## Useful Commands

- `docker compose up --build` - build and start everything (preferred first-time setup)
- `docker compose down` - stop and remove containers
- `cd backend && uvicorn main:app --reload` - run backend locally
- `cd frontend && npm run dev` - run frontend locally

## License

This project currently does not specify a license in the root README. Please refer to the repository metadata or add a `LICENSE` file if you want to share it publicly.
