import json
import os
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from google import genai
from supabase import Client, create_client

# load .env from the backend root (adjust path if your .env lives elsewhere)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"))

api_key = os.getenv("GEMINI_API_KEY")
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
perenual_key = os.getenv("PERENUAL_API_KEY")
if not api_key:
    raise RuntimeError("Missing GEMINI_API_KEY environment variable")
if not supabase_url or not supabase_key:
    raise RuntimeError("Missing Supabase credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)")
if not perenual_key:
    raise RuntimeError("Missing PERENUAL_API_KEY environment variable")

client = genai.Client(api_key=api_key)
supabase: Client = create_client(supabase_url, supabase_key)

DEFAULT_MODEL = "gemini-2.5-flash"
PERENUAL_BASE = "https://perenual.com/api"


def _fetch_user_location(user_id: str) -> Dict[str, Optional[str]]:
    """
    Pull minimal location context for a user from Supabase.
    Returns a dict with city/region/country and optional climate tags.
    """
    resp = supabase.table("users").select("city,region,country,climate_zone,notes").eq("id", user_id).maybe_single()
    if resp.error:
        raise RuntimeError(f"Supabase error: {resp.error}")
    return resp.data or {}


def _normalize_location(loc: Dict[str, Optional[str]]) -> str:
    parts = [loc.get("city"), loc.get("region"), loc.get("country")]
    label = ", ".join(p for p in parts if p)
    climate_bits = [loc.get("climate_zone"), loc.get("notes")]
    extras = "; ".join(b for b in climate_bits if b)
    if extras:
        return f"{label or 'unspecified location'} ({extras})"
    return label or "unspecified location"


def _build_prompt(location_label: str, limit: int) -> str:
    return (
        "You are a horticulture expert. Suggest plants that thrive in the user's home area. "
        f"Location: {location_label}. Return ONLY plant common names, no care text. "
        f"Return JSON: {{\"plants\": [\"name1\", \"name2\", ...]}} with at most {limit} items. "
        "Avoid invasive or banned species; default to widely available houseplants and balcony-friendly options."
    )


def _parse_json_text(text: str) -> Any:
    """
    Parse JSON even if wrapped in fences. Raises on failure.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if "\n" in cleaned:
            cleaned = cleaned.split("\n", 1)[1]
        cleaned = cleaned.strip()
    return json.loads(cleaned)


def _call_gemini_for_names(prompt: str, model: str, limit: int) -> List[str]:
    response = client.responses.generate(
        model=model,
        contents=prompt,
        response_mime_type="application/json",
    )
    payload = _parse_json_text(response.text)
    plants = payload.get("plants", []) if isinstance(payload, dict) else payload
    names: List[str] = []
    seen = set()
    for name in plants:
        candidate = None
        if isinstance(name, str):
            candidate = name.strip()
        elif isinstance(name, dict) and "name" in name and isinstance(name["name"], str):
            candidate = name["name"].strip()
        if candidate:
            lowered = candidate.lower()
            if lowered not in seen:
                seen.add(lowered)
                names.append(candidate)
    return names[:limit]


def _perenual_get_json(path: str, params: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{PERENUAL_BASE}{path}"
    resp = requests.get(url, params=params, timeout=10)
    if resp.status_code >= 400:
        raise RuntimeError(f"Perenual error {resp.status_code}: {resp.text[:200]}")
    return resp.json()


def _enrich_with_perenual(plant_name: str) -> Dict[str, Any]:
    """
    Resolve a plant name to Perenual species and pull detail + care guide.
    Returns a combined dict; falls back to name-only on failure.
    """
    try:
        search = _perenual_get_json(
            "/species-list",
            {"key": perenual_key, "q": plant_name, "page": 1},
        )
        candidates = search.get("data", [])
        if not candidates:
            return {"name": plant_name, "source": "gemini", "perenual_match": None}
        top = candidates[0]
        species_id = top.get("id")
        detail = _perenual_get_json(f"/species/details/{species_id}", {"key": perenual_key}) if species_id else {}
        care = _perenual_get_json(f"/species-care-guide/{species_id}", {"key": perenual_key}) if species_id else {}
        return {
            "name": plant_name,
            "source": "gemini",
            "perenual_match": {
                "id": species_id,
                "common_name": top.get("common_name") or plant_name,
                "scientific_name": top.get("scientific_name"),
                "sunlight": detail.get("sunlight") or top.get("sunlight"),
                "watering": detail.get("watering") or top.get("watering"),
                "cycle": detail.get("cycle") or top.get("cycle"),
                "default_image": (detail.get("default_image") or {}).get("regular_url"),
                "care_instructions": care.get("data", []),
            },
        }
    except Exception as exc:
        return {"name": plant_name, "source": "gemini", "perenual_match": None, "error": str(exc)}


def get_location_recommendations(
    user_id: str,
    limit: int = 5,
    model: str = DEFAULT_MODEL,
) -> Dict[str, Any]:
    """
    Generate plant recommendations for a user's location.
    Returns a dict with location metadata, source model, and enriched plant details.
    """
    location = _fetch_user_location(user_id)
    loc_label = _normalize_location(location)

    try:
        prompt = _build_prompt(loc_label, limit)
        names = _call_gemini_for_names(prompt, model, limit)
    except Exception as exc:
        return {
            "location": loc_label,
            "source_model": model,
            "plants": [],
            "error": f"Gemini call failed: {exc}",
        }

    plants: List[Dict[str, Any]] = []
    for name in names:
        plants.append(_enrich_with_perenual(name))

    return {"location": loc_label, "source_model": model, "plants": plants}


if __name__ == "__main__":
    # Simple CLI smoke test (non-exceptional failures will still print)
    sample_user_id = os.environ.get("TEST_USER_ID", "")
    if not sample_user_id:
        print("Set TEST_USER_ID to exercise location recommendations.")
    else:
        result = get_location_recommendations(sample_user_id)
        print(json.dumps(result, indent=2))
