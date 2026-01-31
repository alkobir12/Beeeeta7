from fastapi import APIRouter
import os

router = APIRouter(prefix="/api/cleanup")


def _is_service(name: str, category: str) -> bool:
    name = (name or "").strip()
    category = (category or "").strip()

    prefixes = (
        "فك وتركيب",
        "تركيب",
        "توضيب",
        "صيانة",
        "صيانه",
    )

    if name.startswith(prefixes):
        return True

    if category.startswith(("توضيب",)):
        return True

    return False


@router.post("/split-parts-services")
async def split_parts_services():
    """Move any service-like rows that ended up in parts into services, then remove them from parts.

    This is meant as a one-time cleanup after importing mixed Excel files.
    Works only when DB_PROVIDER=supabase.
    """

    if os.environ.get("DB_PROVIDER", "mongo").lower() != "supabase":
        return {"success": False, "message": "DB_PROVIDER must be supabase"}

    from supabase_service import SupabaseService

    supa = SupabaseService()
    if not supa or not getattr(supa, "client", None):
        return {"success": False, "message": "Supabase not initialized"}

    client = supa.client

    parts = client.table("parts").select("id,part_number,name,category,selling_price").execute().data or []

    to_move = []
    to_delete_ids = []
    for p in parts:
        name = p.get("name") or ""
        category = p.get("category") or ""
        if _is_service(name, category):
            to_move.append(
                {
                    "name": name,
                    "category": category,
                    "price": float(p.get("selling_price") or 0),
                    "duration_minutes": 30,
                    "active": True,
                }
            )
            to_delete_ids.append(p.get("id"))

    # upsert services by name (requires unique constraint)
    moved = 0
    if to_move:
        client.table("services").upsert(to_move, on_conflict="name").execute()
        moved = len(to_move)

    deleted = 0
    if to_delete_ids:
        # delete in chunks (supabase IN)
        chunk = 200
        for i in range(0, len(to_delete_ids), chunk):
            ids = [x for x in to_delete_ids[i : i + chunk] if x]
            if ids:
                client.table("parts").delete().in_("id", ids).execute()
                deleted += len(ids)

    return {"success": True, "moved_to_services": moved, "deleted_from_parts": deleted}
