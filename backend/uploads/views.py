from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.conf import settings
import requests
import os
import traceback
import uuid
import json
from functools import lru_cache

@csrf_exempt
def upload_photo(request):
    if request.method == "POST" and request.FILES.get("photo"):
        photo = request.FILES["photo"]
        save_path = os.path.join(settings.MEDIA_ROOT, photo.name)

        # Save the file to /media/
        with open(save_path, "wb+") as destination:
            for chunk in photo.chunks():
                destination.write(chunk)

        return JsonResponse({"status": "ok", "file_url": f"{settings.MEDIA_URL}{photo.name}"})

    return JsonResponse({"status": "error", "message": "No photo uploaded"}, status=400)

@csrf_exempt
def classify_plant(request):
    if request.method != "POST" or "photo" not in request.FILES:
        return JsonResponse({"error": "No photo uploaded"}, status=400)

    api_key = os.getenv("PLANTNET_API_KEY", "")

    if not api_key:
        return JsonResponse({"error": "PlantNet API key not configured"}, status=500)
    photo = request.FILES["photo"]
    response = requests.post(
        f"https://my-api.plantnet.org/v2/identify/all?api-key={api_key}",
        files={"images": photo},
        data={"organs": "leaf"}
    )

    if response.status_code != 200:
        return JsonResponse({"error": "Failed to classify plant"}, status=500)

    data = response.json()
    best = data.get("results", [])[0] if data.get("results") else None

    if best:
        perenual_api_key = os.getenv("PERENUAL_API_KEY", "")
        scientific_name = best["species"].get("scientificNameWithoutAuthor")
        common_name = best["species"]["commonNames"][0] if best["species"]["commonNames"] else None
        plant_name = scientific_name or common_name

        perenual_data = get_perenual_enrichment(plant_name, perenual_api_key)

        response_payload = {
            "class": scientific_name,
            "common_name": common_name,
            "score": best["score"],
        }
        if perenual_data:
            response_payload["perenual"] = perenual_data

        return JsonResponse(response_payload)
    return JsonResponse({"error": "No plant identified"}, status=404)


PERENUAL_SEARCH_URL = "https://perenual.com/api/species-list"
PERENUAL_DETAILS_URL = "https://perenual.com/api/species/details"


def get_perenual_enrichment(plant_name, api_key, http_client=requests):
    """Look up care instructions and metadata from Perenual for the provided plant name."""
    if not plant_name or not api_key:
        return None

    try:
        return _get_perenual_enrichment_cached(plant_name.lower(), api_key, http_client)
    except Exception:
        # If Perenual fails for any reason, don't block the PlantNet response.
        return None


@lru_cache(maxsize=128)
def _get_perenual_enrichment_cached(normalized_name, api_key, http_client):
    search_resp = http_client.get(
        PERENUAL_SEARCH_URL,
        params={"key": api_key, "q": normalized_name},
        timeout=10,
    )

    if search_resp.status_code != 200:
        return None

    search_data = search_resp.json()
    results = search_data.get("data") or search_data.get("results") or []

    match = None
    for candidate in results:
        sci = (candidate.get("scientific_name") or "").lower()
        others = [name.lower() for name in candidate.get("other_name") or []]
        if normalized_name == sci or normalized_name in others:
            match = candidate
            break

    if not match and results:
        match = results[0]

    species_id = match.get("id") if match else None
    if not species_id:
        return None

    detail_resp = http_client.get(
        f"{PERENUAL_DETAILS_URL}/{species_id}",
        params={"key": api_key},
        timeout=10,
    )

    if detail_resp.status_code != 200:
        return None

    detail = detail_resp.json()

    return {
        "care": {
            "watering": detail.get("watering"),
            "sunlight": detail.get("sunlight"),
            "pruning_month": detail.get("pruning_month"),
            "maintenance": detail.get("maintenance"),
            "watering_general_benchmark": detail.get("watering_general_benchmark"),
        },
        "species": {
            "id": detail.get("id"),
            "common_name": detail.get("common_name"),
            "scientific_name": detail.get("scientific_name"),
            "family": detail.get("family"),
            "origin": detail.get("origin"),
            "type": detail.get("type"),
            "cycle": detail.get("cycle"),
            "watering": detail.get("watering"),
            "sunlight": detail.get("sunlight"),
            "other_name": detail.get("other_name"),
        },
    }
