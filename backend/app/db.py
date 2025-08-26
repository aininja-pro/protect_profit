import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Supabase URL and Service Key must be set in environment variables")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_supabase_client() -> Client:
    """Get the Supabase client instance"""
    return supabase

async def test_connection():
    """Test the database connection"""
    try:
        # Simple query to test connection
        result = supabase.table("projects").select("*").limit(1).execute()
        return {"status": "connected", "data": result.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}