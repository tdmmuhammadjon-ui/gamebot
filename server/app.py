import os
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from aiogram import Bot
from bot.bot import create_bot_router
from server.auth import validate_init_data

# Load environment configuration
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
WEBAPP_URL = os.getenv("WEBAPP_URL", "http://localhost:8000")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("anti-gravity-server")

# In-memory storage for high scores / leaderboard
leaderboard_store: List[Dict[str, Any]] = [
    {"user_id": 1001, "username": "CosmoPilot", "name": "Astra", "score": 2450},
    {"user_id": 1002, "username": "QuantumDrifter", "name": "Nova", "score": 1980},
    {"user_id": 1003, "username": "ZeroGVoyager", "name": "Orion", "score": 1420},
]

# Lifespan for handling Bot startup & polling alongside FastAPI
@asynccontextmanager
async def lifespan(app: FastAPI):
    bot_task = None
    bot = None
    if BOT_TOKEN and BOT_TOKEN != "YOUR_BOT_TOKEN_HERE":
        try:
            bot = Bot(token=BOT_TOKEN)
            dp = create_bot_router(bot, WEBAPP_URL)
            logger.info("Starting Telegram Bot long-polling...")
            bot_task = asyncio.create_task(dp.start_polling(bot))
        except Exception as e:
            logger.error(f"Failed to initialize Telegram Bot: {e}")
    else:
        logger.warning("BOT_TOKEN is not configured! Telegram bot polling will not start.")
        
    yield
    
    if bot_task and bot:
        logger.info("Stopping Telegram Bot polling...")
        bot_task.cancel()
        try:
            await bot.session.close()
        except Exception:
            pass

app = FastAPI(
    title="Anti-Gravity Telegram Mini App Backend",
    description="Backend API for Telegram WebApp session verification, high-scores, and static delivery",
    lifespan=lifespan
)

# Enable CORS for Telegram WebApp environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Request / Response Models -----------------

class VerifyRequest(BaseModel):
    initData: str = Field(..., description="Telegram WebApp initData string")

class SubmitScoreRequest(BaseModel):
    initData: str = Field(..., description="Telegram WebApp initData string")
    score: int = Field(..., ge=0, description="Player score achieved in session")
    collected_gems: Optional[int] = Field(0, description="Number of gems collected")

# ----------------- API Endpoints -----------------

@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "bot_configured": BOT_TOKEN != "YOUR_BOT_TOKEN_HERE",
        "webapp_url": WEBAPP_URL
    }

@app.post("/api/auth/verify")
async def verify_telegram_session(req: VerifyRequest):
    """
    Validates Telegram WebApp initData cryptographic signature.
    Prevents unauthorized or spoofed client requests.
    """
    validated = validate_init_data(req.initData, BOT_TOKEN)
    if not validated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Telegram WebApp signature"
        )
    return {
        "success": True,
        "user": validated.get("user", {}),
        "auth_date": validated.get("auth_date")
    }

@app.post("/api/score/submit")
async def submit_score(req: SubmitScoreRequest):
    """
    Submits player score after validating HMAC signature on Telegram initData.
    """
    validated = validate_init_data(req.initData, BOT_TOKEN)
    if not validated:
        # In local testing without Telegram, allow dummy verification with warning
        if req.initData == "test_dev_mode":
            user = {"id": 999999, "first_name": "DevTester", "username": "local_dev"}
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Signature validation failed. Score submission rejected."
            )
    else:
        user = validated.get("user", {})

    user_id = user.get("id", 0)
    user_name = user.get("first_name", "Explorer")
    username = user.get("username", "")

    # Check if user already exists in leaderboard
    existing_entry = next((item for item in leaderboard_store if item["user_id"] == user_id), None)
    if existing_entry:
        if req.score > existing_entry["score"]:
            existing_entry["score"] = req.score
            existing_entry["name"] = user_name
            existing_entry["username"] = username
    else:
        leaderboard_store.append({
            "user_id": user_id,
            "name": user_name,
            "username": username,
            "score": req.score
        })

    # Sort descending
    leaderboard_store.sort(key=lambda x: x["score"], reverse=True)

    # Find current user rank
    rank = next((idx + 1 for idx, item in enumerate(leaderboard_store) if item["user_id"] == user_id), None)

    return {
        "success": True,
        "user_score": req.score,
        "rank": rank,
        "top_players": leaderboard_store[:10]
    }

@app.get("/api/score/leaderboard")
async def get_leaderboard():
    """
    Retrieves top 10 global leaderboard.
    """
    return {
        "success": True,
        "leaderboard": leaderboard_store[:10]
    }

# ----------------- Static File Delivery -----------------
static_dir = Path(__file__).resolve().parent.parent / "static"
if not static_dir.exists():
    static_dir.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

@app.get("/")
async def serve_index():
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse({"message": "Frontend static file index.html not found yet."}, status_code=404)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.app:app", host=HOST, port=PORT, reload=True)
