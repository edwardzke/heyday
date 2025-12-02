import json
import os
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
from google import genai
from supabase import Client, create_client
from . import perenual_service

# load .env from the backend root (adjust path if your .env lives elsewhere)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"))

api_key = os.getenv("GEMINI_API_KEY")
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not api_key:
    raise RuntimeError("Missing GEMINI_API_KEY environment variable")
if not supabase_url or not supabase_key:
    raise RuntimeError("Missing Supabase credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)")
client = genai.Client(api_key=api_key)
supabase: Client = create_client(supabase_url, supabase_key)

# 1) Normalize the RoomPlan JSON into a lean schema (rooms, dimensions, doors/windows, light level, climate). Cache this as a dict.
# 2) Pull user context from Supabase (location/climate preferences, experience level, plant style prefs).
# 3) Build a deterministic prompt that fuses room metadata + user prefs + constraints (toxicity, maintenance).
# 4) Call Gemini (gemini-2.5-pro) with system+user turns; request a tight JSON schema (per-room plant recs, placement, care notes).
# 5) Validate/repair the model JSON, persist to Supabase for analytics, and return to the client.


def _summarize_roomplan(roomplan_json: Dict[str, Any], window_orientation: Optional[str] = None) -> str:
    """
    Extract key layout facts from RoomPlan JSON.
    Uses the bundled Room.json structure to pull a compact summary that Gemini can work with.
    """
    sections = roomplan_json.get("sections", [])
    doors = roomplan_json.get("doors", [])
    windows = roomplan_json.get("windows", [])
    objects = roomplan_json.get("objects", [])
    orientation_char = (window_orientation or "").strip().upper()[:1]
    orientation_map = {
        "N": "north-facing",
        "S": "south-facing",
        "E": "east-facing",
        "W": "west-facing",
    }
    orientation_desc = orientation_map.get(orientation_char, "unknown exposure")

    room_labels = [s.get("label", "unlabeled") for s in sections]

    def _categorize_objects(objs: List[Dict[str, Any]]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for obj in objs:
            cat = obj.get("category", {})
            if not cat:
                continue
            key = next(iter(cat.keys()))
            counts[key] = counts.get(key, 0) + 1
        return counts

    object_counts = _categorize_objects(objects)
    object_summary = ", ".join(f"{k}:{v}" for k, v in object_counts.items()) if object_counts else "no objects detected"

    return (
        f"Rooms: {', '.join(room_labels) or 'none'} ({len(room_labels)} total). "
        f"Doors: {len(doors)}. Windows: {len(windows)} ({orientation_desc}). "
        f"Detected furnishings/appliances: {object_summary}. "
        "Use RoomPlan centers as rough room positions; assume standard ceiling height; "
        "no explicit light readings provided—deduce likely light from room role (kitchen/living near windows)."
    )


def _build_prompt(user: Dict[str, Any], roomplan_json: Dict[str, Any], window_orientation: Optional[str] = None) -> str:
    roomplan_summary = _summarize_roomplan(roomplan_json, window_orientation)
    user_location = user.get("location", "unspecified location")
    experience = user.get("plant_experience", "beginner")
    style = user.get("style_preference", "modern minimal")
    toxicity_pref = user.get("toxicity_sensitivity", "pet/kid safe preferred")
    maintenance = user.get("maintenance_level", "low-maintenance desired")

    return (
        "You are a master botanist and interior garden designer. "
        "Given a RoomPlan layout, propose indoor plant placements that are realistic to source. "
        f"RoomPlan summary: {roomplan_summary}. "
        f"User location: {user_location}. Experience: {experience}. Style: {style}. "
        f"Constraints: {toxicity_pref}; {maintenance}. "
        "Return JSON keyed by room with fields: plants (name, light need, watering), placement, and reasoning. "
        "Be concise and stay within practical plant options available in common stores."
    )


def _load_example_roomplan() -> Dict[str, Any]:
    """Load the bundled Room.json as a fallback example."""
    example_path = os.path.join(os.path.dirname(__file__), "Room.json")
    with open(example_path, "r") as f:
        return json.load(f)


def _call_gemini(prompt: str) -> str:
    response = client.responses.generate(
        model="gemini-2.5-flash",
        contents=prompt,
        response_mime_type="application/json",
    )
    return response.text  # already JSON per mime type


def get_floor_plan_recommendations(
    user_id: str,
    roomplan_json: Optional[Dict[str, Any]] = None,
    window_orientation: Optional[str] = None,
    enrich_perenual: bool = True,
) -> Dict[str, Any]:
    """
    Generate plant recommendations for a RoomPlan JSON. If roomplan_json is omitted,
    the bundled Room.json sample is used (useful for testing).

    Args:
        user_id: Supabase user ID
        roomplan_json: RoomPlan JSON structure (optional, uses example if not provided)
        window_orientation: Window orientation (N/S/E/W) for light-aware recommendations
        enrich_perenual: Whether to enrich plant names with Perenual data (default True)

    Returns:
        Dict with structure:
        {
            "user_id": str,
            "roomplan_summary": str,
            "window_orientation": str | None,
            "source_model": "gemini-2.5-flash",
            "recommendations": {
                "room_name": {
                    "plants": [
                        {
                            "name": str,
                            "light_need": str,
                            "watering": str,
                            "perenual_data": {...} | None  # if enrich_perenual=True
                        },
                        ...
                    ],
                    "placement": str,
                    "reasoning": str
                },
                ...
            }
        }
    """
    # Fetch user data from Supabase
    resp = supabase.table("users").select("*").eq("id", user_id).execute()
    if not resp.data:
        raise RuntimeError(f"User {user_id} not found in Supabase")
    user = resp.data[0]

    plan = roomplan_json or _load_example_roomplan()
    prompt = _build_prompt(user, plan, window_orientation)

    # Get Gemini recommendations
    gemini_json_str = _call_gemini(prompt)

    # Parse Gemini response
    try:
        gemini_data = json.loads(gemini_json_str)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse Gemini response: {e}")

    # Enrich plant recommendations with Perenual data
    if enrich_perenual and isinstance(gemini_data, dict):
        for room_name, room_data in gemini_data.items():
            if isinstance(room_data, dict) and "plants" in room_data:
                plants = room_data["plants"]
                if isinstance(plants, list):
                    for plant in plants:
                        if isinstance(plant, dict) and "name" in plant:
                            plant_name = plant["name"]
                            perenual_data = perenual_service.enrich_plant_with_perenual(plant_name)
                            plant["perenual_data"] = perenual_data

    # Build structured response
    roomplan_summary = _summarize_roomplan(plan, window_orientation)

    return {
        "user_id": user_id,
        "roomplan_summary": roomplan_summary,
        "window_orientation": window_orientation,
        "source_model": "gemini-2.5-flash",
        "recommendations": gemini_data,
    }
