from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from database import engine
from models import Base
from routers import providers, credentials, progress

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Jizzarr API", version="1.1.0")

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

@app.get("/")
async def root():
    return {"message": "Jizzarr API"}
