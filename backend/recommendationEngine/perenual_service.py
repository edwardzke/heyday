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


def _perenual_request(endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Make a request to the Perenual API with timeout and error handling."""
    params = params or {}
    params["key"] = PERENUAL_API_KEY

    url = f"{PERENUAL_BASE_URL}{endpoint}"
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Perenual API error: {e}")


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

        # Step 2: Find best match (exact match on scientific or common name)
        best_match = None
        for candidate in candidates:
            sci_name = (candidate.get("scientific_name") or "").lower()
            common_names = [name.lower() for name in candidate.get("other_name", [])]

            if normalized_name == sci_name or normalized_name in common_names:
                best_match = candidate
                break

        # Fall back to first result if no exact match
        if not best_match:
            best_match = candidates[0]

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
                "care_notes": None,
                "error": "No species ID found",
            }

        # Step 3: Fetch detailed species information
        details = _perenual_request(f"/species/details/{species_id}")

        # Step 4: Fetch care guide
        try:
            care_guide_response = _perenual_request(f"/species-care-guide-list", {"species_id": species_id})
            care_sections = care_guide_response.get("data", [])

            # Combine care instructions into a single text block
            care_notes_list = []
            for section in care_sections:
                section_type = section.get("type", "General")
                description = section.get("description", "")
                if description:
                    care_notes_list.append(f"{section_type}: {description}")
            care_notes = "\n\n".join(care_notes_list) if care_notes_list else None
        except Exception:
            care_notes = None

        # Step 5: Extract and format data to match Supabase plants table schema
        default_image = details.get("default_image", {})
        if isinstance(default_image, dict):
            image_url = default_image.get("regular_url") or default_image.get("original_url")
        else:
            image_url = None

        # Parse sunlight (Perenual returns a list, we want a comma-separated string)
        sunlight_list = details.get("sunlight", [])
        sunlight_str = ", ".join(sunlight_list) if isinstance(sunlight_list, list) else None

        # Extract watering info
        watering_benchmark = details.get("watering_general_benchmark", {})
        if isinstance(watering_benchmark, dict):
            watering_value = watering_benchmark.get("value")
            watering_unit = watering_benchmark.get("unit", "")
            watering_text = f"{watering_value} {watering_unit}" if watering_value else None
        else:
            watering_text = details.get("watering")

        # Calculate watering interval in days (rough estimate)
        watering_interval = None
        if details.get("watering"):
            watering_lower = details["watering"].lower()
            if "daily" in watering_lower or "frequent" in watering_lower:
                watering_interval = 1
            elif "average" in watering_lower or "moderate" in watering_lower:
                watering_interval = 3
            elif "minimum" in watering_lower or "rare" in watering_lower:
                watering_interval = 7

        return {
            "name": normalized_name,
            "perenual_id": species_id,
            "common_name": details.get("common_name"),
            "scientific_name": details.get("scientific_name") or best_match.get("scientific_name"),
            "watering_general_benchmark": watering_text,
            "watering_interval_days": watering_interval,
            "sunlight": sunlight_str,
            "maintenance_category": details.get("maintenance"),
            "poison_human": details.get("poisonous_to_humans") == 1,
            "poison_pets": details.get("poisonous_to_pets") == 1,
            "default_image_url": image_url,
            "care_notes": care_notes,
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
