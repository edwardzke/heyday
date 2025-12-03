"""Centralized Perenual API integration service.

This module provides a single source of truth for Perenual API interactions,
ensuring consistent data formatting across the backend.
"""
import os
from functools import lru_cache
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv

# Load environment variables
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"))

PERENUAL_API_KEY = os.getenv("PERENUAL_API_KEY")
PERENUAL_BASE_URL = "https://perenual.com/api"

if not PERENUAL_API_KEY:
    raise RuntimeError("Missing PERENUAL_API_KEY environment variable")


def _perenual_request(endpoint: str, params: Optional[Dict[str, Any]] = None, max_retries: int = 3) -> Dict[str, Any]:
    """Make a request to the Perenual API with timeout, rate limit handling, and retries."""
    import time
    
    params = params or {}
    params["key"] = PERENUAL_API_KEY

    url = f"{PERENUAL_BASE_URL}{endpoint}"
    
    for attempt in range(max_retries):
        try:
            response = requests.get(url, params=params, timeout=10)
            
            # Handle rate limiting with exponential backoff
            if response.status_code == 429:
                if attempt < max_retries - 1:
                    wait_time = 15  # 15s wait for rate limits
                    print(f"⏳ Rate limited, waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                    time.sleep(wait_time)
                    continue
                else:
                    raise RuntimeError(f"Perenual API rate limit exceeded after {max_retries} retries")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1 and "429" not in str(e):
                wait_time = (2 ** attempt) * 0.5
                print(f"⏳ Request failed, retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
                continue
            raise RuntimeError(f"Perenual API error: {e}")
    
    raise RuntimeError("Perenual API request failed after all retries")


def _parse_plant_name(full_name: str) -> tuple:
    """
    Parse Perenual's common_name which often includes scientific name in parentheses.

    Examples:
        "Golden Pothos (Epipremnum aureum)" -> ("Golden Pothos", "Epipremnum aureum")
        "Snake Plant" -> ("Snake Plant", None)
        "Peace Lily (Spathiphyllum)" -> ("Peace Lily", "Spathiphyllum")

    Returns:
        (common_name, scientific_name_from_parentheses)
    """
    import re

    if not full_name:
        return (None, None)

    # Check if name contains parentheses with scientific name
    match = re.match(r'^(.+?)\s*\(([^)]+)\)\s*$', full_name.strip())

    if match:
        common_name = match.group(1).strip()
        scientific_name = match.group(2).strip()
        return (common_name, scientific_name)
    else:
        # No parentheses found, entire string is common name
        return (full_name.strip(), None)


@lru_cache(maxsize=256)
def _enrich_plant_cached(normalized_name: str) -> Dict[str, Any]:
    """
    Cached version of plant enrichment.

    Args:
        normalized_name: Lowercase plant name for cache key consistency

    Returns:
        Dict matching Supabase plants table schema
    """
    try:
        # Step 1: Search for the plant
        search_results = _perenual_request("/species-list", {"q": normalized_name, "page": 1})

        candidates = search_results.get("data", [])
        if not candidates:
            return {
                "name": normalized_name,
                "perenual_id": None,
                "common_name": None,
                "scientific_name": None,
                "watering_general_benchmark": None,
                "watering_interval_days": None,
                "sunlight": None,
                "maintenance_category": None,
                "poison_human": None,
                "poison_pets": None,
                "default_image_url": None,
                "care_notes": None,
                "error": "No Perenual match found",
            }

        # Debug: Log first candidate structure
        if candidates:
            print(f"🔍 First candidate structure: {candidates[0]}")

        # Step 2: Find best match (prioritize scientific name match, then common name)
        best_match = None
        partial_match = None
        
        for candidate in candidates:
            # Handle scientific_name (Perenual returns it as a list)
            sci_name_raw = candidate.get("scientific_name") or ""
            if isinstance(sci_name_raw, list) and sci_name_raw:
                sci_name = str(sci_name_raw[0]).lower()
            else:
                sci_name = str(sci_name_raw).lower() if sci_name_raw else ""
            
            # Handle common_name (usually string, but be defensive)
            common_name_raw = candidate.get("common_name") or ""
            if isinstance(common_name_raw, list) and common_name_raw:
                common_name = str(common_name_raw[0]).lower()
            else:
                common_name = str(common_name_raw).lower() if common_name_raw else ""
            
            # Safely handle other_name field (can be list or None)
            other_names = candidate.get("other_name", [])
            if other_names and isinstance(other_names, list):
                common_names = [str(name).lower() for name in other_names if name]
            else:
                common_names = []

            # Exact scientific name match (highest priority)
            if normalized_name == sci_name:
                best_match = candidate
                print(f"✅ Exact scientific name match: {sci_name}")
                break
            
            # Partial scientific name match (genus match)
            if " " in normalized_name and sci_name.startswith(normalized_name.split()[0]):
                if not partial_match:
                    partial_match = candidate
            
            # Exact common name match (lower priority)
            if normalized_name == common_name or normalized_name in common_names:
                if not best_match:
                    best_match = candidate
                    print(f"✅ Exact common name match: {common_name}")
                    break

        # Use partial match if no exact match found
        if not best_match and partial_match:
            best_match = partial_match
            print(f"⚠️ Using partial (genus) match: {partial_match.get('scientific_name')}")
        
        # Fall back to first result if no match
        if not best_match:
            best_match = candidates[0]
            print(f"⚠️ Using first result: {best_match.get('scientific_name')}")

        species_id = best_match.get("id")
        if not species_id:
            return {
                "name": normalized_name,
                "perenual_id": None,
                "common_name": best_match.get("common_name"),
                "scientific_name": best_match.get("scientific_name"),
                "watering_general_benchmark": None,
                "watering_interval_days": None,
                "sunlight": None,
                "maintenance_category": None,
                "poison_human": None,
                "poison_pets": None,
                "default_image_url": None,
                "error": "No species ID found",
            }

        # Step 3: Fetch detailed species information using v2 API
        details = _perenual_request(f"/v2/species/details/{species_id}")

        # Step 4: Extract and format data to match Supabase plants table schema
        # Free tier returns "Upgrade Plans" message for premium-only fields

        # Extract image URL with fallbacks and HTTPS conversion
        default_image = details.get("default_image", {})
        if isinstance(default_image, dict):
            image_url = (
                default_image.get("regular_url")
                or default_image.get("medium_url")
                or default_image.get("small_url")
                or default_image.get("thumbnail")
                or default_image.get("original_url")
            )

            # Ensure HTTPS protocol and skip premium placeholder images
            if image_url:
                if image_url.startswith("http://"):
                    image_url = image_url.replace("http://", "https://", 1)
                if "upgrade_access" in image_url:
                    image_url = None
        else:
            image_url = None

        # Parse sunlight (free tier may return list or "Upgrade Plans" string)
        sunlight_raw = details.get("sunlight", [])
        if isinstance(sunlight_raw, list):
            sunlight_str = ", ".join(sunlight_raw) if sunlight_raw else None
        elif isinstance(sunlight_raw, str) and "Upgrade Plans" not in sunlight_raw:
            sunlight_str = sunlight_raw
        else:
            sunlight_str = None

        # Extract watering info (handle both dict and string formats)
        watering_benchmark = details.get("watering_general_benchmark", {})
        if isinstance(watering_benchmark, dict):
            watering_value = watering_benchmark.get("value")
            watering_unit = watering_benchmark.get("unit", "")
            watering_text = f"{watering_value} {watering_unit}" if watering_value else None
        else:
            watering_raw = details.get("watering")
            if isinstance(watering_raw, str) and "Upgrade Plans" not in watering_raw:
                watering_text = watering_raw
            else:
                watering_text = None

        # Calculate watering interval in days (rough estimate)
        watering_interval = None
        if watering_text:
            watering_lower = watering_text.lower()
            if "daily" in watering_lower or "frequent" in watering_lower:
                watering_interval = 1
            elif "average" in watering_lower or "moderate" in watering_lower:
                watering_interval = 3
            elif "minimum" in watering_lower or "rare" in watering_lower:
                watering_interval = 7

        # Parse common name (may contain scientific name in parentheses)
        raw_common_name = details.get("common_name")
        parsed_common, parsed_scientific = _parse_plant_name(raw_common_name)

        # Extract scientific_name (Perenual returns it as a list)
        sci_name_raw = details.get("scientific_name") or best_match.get("scientific_name")
        if isinstance(sci_name_raw, list) and sci_name_raw:
            scientific_name = sci_name_raw[0]
        else:
            scientific_name = sci_name_raw or parsed_scientific

        # Handle maintenance (may be premium-only)
        maintenance_raw = details.get("maintenance")
        if isinstance(maintenance_raw, str) and "Upgrade Plans" in maintenance_raw:
            maintenance = None
        else:
            maintenance = maintenance_raw

        # Handle toxicity info (may be premium-only or missing)
        poison_human_raw = details.get("poisonous_to_humans")
        poison_pets_raw = details.get("poisonous_to_pets")
        
        poison_human = poison_human_raw == 1 if poison_human_raw is not None else None
        poison_pets = poison_pets_raw == 1 if poison_pets_raw is not None else None

        return {
            "name": normalized_name,
            "perenual_id": species_id,
            "common_name": parsed_common,  # Clean common name without parentheses
            "scientific_name": scientific_name,
            "watering_general_benchmark": watering_text,
            "watering_interval_days": watering_interval,
            "sunlight": sunlight_str,
            "maintenance_category": maintenance,
            "poison_human": poison_human,
            "poison_pets": poison_pets,
            "default_image_url": image_url,
            "error": None,
        }

    except Exception as e:
        return {
            "name": normalized_name,
            "perenual_id": None,
            "common_name": None,
            "scientific_name": None,
            "watering_general_benchmark": None,
            "watering_interval_days": None,
            "sunlight": None,
            "maintenance_category": None,
            "poison_human": None,
            "poison_pets": None,
            "default_image_url": None,
            "care_notes": None,
            "error": f"Enrichment failed: {str(e)}",
        }


def enrich_plant_with_perenual(plant_name: str) -> Dict[str, Any]:
    """
    Enrich a plant name with detailed information from Perenual API.

    This function returns a dictionary that matches the Supabase plants table schema exactly,
    making it easy to upsert into the database.

    Args:
        plant_name: Common or scientific name of the plant

    Returns:
        Dict with keys matching Supabase plants table columns:
            - name: str
            - perenual_id: int | None
            - common_name: str | None
            - scientific_name: str | None
            - watering_general_benchmark: str | None
            - watering_interval_days: int | None
            - sunlight: str | None
            - maintenance_category: str | None
            - poison_human: bool | None
            - poison_pets: bool | None
            - default_image_url: str | None
            - care_notes: str | None
            - error: str | None (if enrichment failed)

    Example:
        >>> result = enrich_plant_with_perenual("Monstera deliciosa")
        >>> print(result["common_name"])
        'Swiss Cheese Plant'
        >>> print(result["watering_interval_days"])
        7
    """
    if not plant_name:
        return {
            "name": "",
            "perenual_id": None,
            "common_name": None,
            "scientific_name": None,
            "watering_general_benchmark": None,
            "watering_interval_days": None,
            "sunlight": None,
            "maintenance_category": None,
            "poison_human": None,
            "poison_pets": None,
            "default_image_url": None,
            "care_notes": None,
            "error": "Empty plant name provided",
        }

    # Normalize for caching
    normalized = plant_name.strip().lower()
    return _enrich_plant_cached(normalized)


def clear_cache():
    """Clear the LRU cache for plant enrichment (useful for testing)."""
    _enrich_plant_cached.cache_clear()
