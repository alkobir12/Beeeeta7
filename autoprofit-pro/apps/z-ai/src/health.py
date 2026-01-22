from fastapi import APIRouter

router = APIRouter()


@router.get("/api/z-ai/health")
async def z_ai_health():
    return {"status": "z-ai engine running"}
