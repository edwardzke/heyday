from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.conf import settings
from django.core.files.storage import default_storage
import requests
import os
import traceback

@csrf_exempt
def upload_photo(request):
    if request.method != "POST" or "photo" not in request.FILES:
        return JsonResponse({"error": "No photo uploaded"}, status=400)

    photo = request.FILES["photo"]

    try:
        # ✅ Save directly to S3
        path = default_storage.save(photo.name, photo)
        file_url = default_storage.url(path)

        return JsonResponse({
            "status": "ok",
            "file_url": file_url
        })
    except Exception as e:
        print("❌ Upload error:", e)
        return JsonResponse({"error": "Upload failed", "details": str(e)}, status=500)

@csrf_exempt
def classify_plant(request):
    try:
        if request.method != "POST" or "photo" not in request.FILES:
            return JsonResponse({"error": "No photo uploaded"}, status=400)

        api_key = os.getenv("PLANTNET_API_KEY")
        if not api_key:
            return JsonResponse({"error": "PlantNet API key not configured"}, status=500)

        photo = request.FILES["photo"]

        # Send image to PlantNet API
        response = requests.post(
            f"https://my-api.plantnet.org/v2/identify/all?api-key={api_key}",
            files={"images": photo},
            data={"organs": "leaf"},
            timeout=30
        )

        if response.status_code == 404:
            return JsonResponse({"error": "No plant identified"}, status=404)
        elif response.status_code != 200:
            print("PlantNet API Error:", response.text[:300])
            return JsonResponse({
                "error": "Plant identification service unavailable",
                "details": response.text[:200],
            }, status=502)

        # Parse and validate the response
        try:
            data = response.json()
        except Exception:
            print("❌ Failed to parse PlantNet JSON:", response.text[:300])
            return JsonResponse({"error": "Failed to parse PlantNet response"}, status=502)

        results = data.get("results", [])
        if not results:
            return JsonResponse({"error": "No plant identified"}, status=404)

        best = results[0]
        return JsonResponse({
            "class": best["species"].get("scientificNameWithoutAuthor"),
            "common_name": best["species"].get("commonNames", [None])[0],
            "score": best.get("score", 0),
        })

    except requests.exceptions.Timeout:
        return JsonResponse({"error": "PlantNet API timed out"}, status=504)
    except Exception as e:
        print("❌ Unexpected error in classify_plant:", e)
        print(traceback.format_exc())
        return JsonResponse({"error": "Internal error during classification"}, status=500)
    
@csrf_exempt
def add_plant(request):
    if request.method != "POST":
        return JsonResponse({"error": "Invalid method"}, status=405)

    try:
        # Get JSON or form data
        species = request.POST.get("species")
        age = request.POST.get("age")
        nickname = request.POST.get("nickname", "")
        photo = request.FILES.get("photo")

        if not age or not species:
            return JsonResponse({"error": "Missing required fields"}, status=400)

        file_url = None
        if photo:
            # Save to S3 (or local)
            from django.core.files.storage import default_storage
            path = default_storage.save(photo.name, photo)
            file_url = default_storage.url(path)

        # (Later we’ll link to user DB model)
        return JsonResponse({
            "status": "success",
            "message": "Plant added successfully",
            "plant": {
                "species": species,
                "age": age,
                "nickname": nickname,
                "photo_url": file_url,
            },
        })

    except Exception as e:
        print("❌ Error saving plant:", e)
        return JsonResponse({"error": "Internal error adding plant"}, status=500)