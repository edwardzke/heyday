"""HTTP API views for the core domain."""
import json
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .serializers import HealthCheckSerializer


@api_view(["GET"])
def health_check(_request):
    """Return a simple payload to validate service health."""
    serializer = HealthCheckSerializer(
        {
            "status": "ok",
            "service": "heyday-backend",
        }
    )
    return Response(serializer.data)


def hello(request):
    return JsonResponse({"message": "Heyday backend is running!"})


def _resolve_frontend_assets() -> dict:
    """Return the appropriate asset configuration depending on build output."""
    frontend_dist = getattr(
        settings,
        "FRONTEND_DIST_DIR",
        Path(settings.BASE_DIR).parent / "frontend" / "dist",
    )
    manifest_path = Path(frontend_dist) / "manifest.json"

    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text())
        except json.JSONDecodeError:
            manifest = {}

        entry = manifest.get("src/main.tsx")
        if entry:
            static_prefix = "/" + settings.STATIC_URL.strip("/")
            js_files = [f"{static_prefix}/{entry['file']}"]
            css_files = [f"{static_prefix}/{path}" for path in entry.get("css", [])]
            return {"mode": "build", "js": js_files, "css": css_files}

    dev_server = getattr(
        settings, "FRONTEND_DEV_SERVER_ORIGIN", "http://localhost:5173"
    ).rstrip("/")
    return {"mode": "dev", "dev_server": dev_server, "js": [], "css": []}


def render_app(request, initial_view: str):
    """Render the React single-page application with the requested view."""
    assets = _resolve_frontend_assets()
    return render(
        request,
        "core/spa.html",
        {
            "initial_view": initial_view,
            "assets": assets,
        },
    )


def landing_page(request):
    """Serve the landing page experience."""
    return render_app(request, "landing")


def dashboard_page(request):
    """Serve the dashboard experience."""
    return render_app(request, "dashboard")
