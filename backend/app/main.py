
import sys
from pathlib import Path

# Ensure the backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import logging
import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sehatlink.main")

try:
    from app.config import settings
    from app.database import engine, Base
    from app.schemas.schemas import (
        TriageRequest,
        TriageResponse,
        EmergencyRequest,
    )
    from app.services.triage_service import analyze_triage
    from app.routers.assistant_router import router as assistant_router
except ImportError:
    from .config import settings
    from .database import engine, Base
    from .schemas.schemas import (
        TriageRequest,
        TriageResponse,
        EmergencyRequest,
    )
    from .services.triage_service import analyze_triage
    from .routers.assistant_router import router as assistant_router


# Initialize database tables
Base.metadata.create_all(bind=engine)


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="Offline-First Multilingual Telemedicine Platform for Rural",
    version="1.0.0",
)


# Configure CORS immediately after creating the app
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://medical-link.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include AI Assistant router
app.include_router(assistant_router)


# Root endpoint
@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "region": "Rural Punjab",
        "version": "1.0.0",
    }


# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "ok"}


# Triage endpoint
@app.post("/api/triage/evaluate", response_model=TriageResponse)
def evaluate_symptoms(request: TriageRequest):
    return analyze_triage(request)


# Emergency dispatch endpoint
@app.post("/api/emergency/dispatch")
def dispatch_emergency(request: EmergencyRequest):
    return {
        "status": "dispatched",
        "alert_id": f"EMG-{uuid.uuid4().hex[:6].upper()}",
        "patient": request.patient_name,
        "village": request.village,
        "eta_minutes": 8,
        "ambulance_unit": "108 Unit #PB-11-7482",
    }


# Pharmacy search endpoint
@app.get("/api/pharmacy/search")
def search_pharmacy(query: str = ""):
    pharmacies = [
        {
            "id": "ph-1",
            "name": "Tab. Sorbitrate (Isosorbide Dinitrate 5mg)",
            "genericName": "Isosorbide Dinitrate",
            "stockStatus": "in_stock",
            "quantity": 45,
            "priceInINR": 12.5,
            "pharmacyName": "Jan Aushadhi Kendra (Govt Hospital)",
            "pharmacyAddress": "Near Circular Road, Rural",
            "distanceKm": 0.8,
            "contactNumber": "+91 98140 12345",
        },
        {
            "id": "ph-2",
            "name": "Tab. Aspirin 150mg",
            "genericName": "Acetylsalicylic Acid",
            "stockStatus": "in_stock",
            "quantity": 120,
            "priceInINR": 8.0,
            "pharmacyName": "Jan Aushadhi Kendra (Govt Hospital)",
            "pharmacyAddress": "Near Circular Road, Rural",
            "distanceKm": 0.8,
            "contactNumber": "+91 98140 12345",
        },
    ]

    if query:
        search_term = query.lower()
        return [
            pharmacy
            for pharmacy in pharmacies
            if search_term in pharmacy["name"].lower()
            or search_term in pharmacy["genericName"].lower()
        ]

    return pharmacies
