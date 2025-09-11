from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Import routers
from .routes import projects, budget, quotes, ai_budget, debug, quote_scopes, ai_chat
from .db import test_connection

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Operation Protect Profit API",
    description="Construction bid management and comparison API",
    version="1.0.0"
)

# Configure CORS
origins = [
    "http://localhost:3000",  # React development server
    "http://localhost:3001",  # Current React port
    "http://localhost:3002",  # Additional React port
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001", 
    "http://127.0.0.1:3002",
"https://protect-profit-frontend.onrender.com"  # Deployed frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects.router, prefix="/api")
app.include_router(budget.router, prefix="/api")  
app.include_router(quotes.router, prefix="/api")
app.include_router(ai_budget.router, prefix="/api")
app.include_router(quote_scopes.router, prefix="/api")
app.include_router(ai_chat.router, prefix="/api")
app.include_router(debug.router, prefix="/api")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Operation Protect Profit API",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    # Test database connection
    db_status = await test_connection()
    
    return {
        "status": "healthy",
        "database": db_status.get("status", "unknown"),
        "services": {
            "openai": "configured" if os.getenv("OPENAI_API_KEY") else "not configured",
            "anthropic": "configured" if os.getenv("ANTHROPIC_API_KEY") else "not configured", 
            "supabase": "configured" if os.getenv("SUPABASE_URL") else "not configured"
        }
    }