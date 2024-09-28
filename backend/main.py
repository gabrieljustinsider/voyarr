from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from database import engine
from models import Base
from routers import providers, credentials, progress, settings, library, duplicates, preferences, metadata, external_api, download, rules, schedules, backup, notifications, apikeys, cookies, transcode

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Voyarr API", version="1.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(providers.router)
app.include_router(credentials.router)
app.include_router(progress.router)
app.include_router(settings.router)
app.include_router(library.router)
app.include_router(duplicates.router)
app.include_router(preferences.router)
app.include_router(metadata.router)
app.include_router(external_api.router)
app.include_router(download.router)
app.include_router(rules.router)
app.include_router(schedules.router)
app.include_router(backup.router)
app.include_router(notifications.router)
app.include_router(apikeys.router)
app.include_router(cookies.router)
app.include_router(transcode.router)

@app.get("/")
async def root():
    return {"message": "Voyarr API"}
