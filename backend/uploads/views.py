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
