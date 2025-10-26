from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.conf import settings
import requests
import os

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
        return JsonResponse({
            "class": best["species"]["scientificNameWithoutAuthor"],
            "common_name": best["species"]["commonNames"][0] if best["species"]["commonNames"] else None,
            "score": best["score"],
        })
    return JsonResponse({"error": "No plant identified"}, status=404)