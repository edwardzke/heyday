"""HTTP API views for the core domain."""
import json
from pathlib import Path

import httpx
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from rest_framework import status
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


@api_view(["GET"])
def weather(request):
    """Proxy current weather data from OpenWeather."""
    api_key = getattr(settings, "OPENWEATHER_API_KEY", "")
    if not api_key:
        return Response(
            {"detail": "OpenWeather API key is not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    units = request.query_params.get("units") or getattr(
        settings, "OPENWEATHER_UNITS", "imperial"
    )
    lat = request.query_params.get("lat")
    lon = request.query_params.get("lon")
    location = request.query_params.get("city") or getattr(
        settings, "OPENWEATHER_DEFAULT_LOCATION", "San Francisco,US"
    )

    params: dict[str, str] = {"appid": api_key, "units": units}
    if lat and lon:
        params.update({"lat": lat, "lon": lon})
    else:
        params["q"] = location

    try:
        with httpx.Client(timeout=5) as client:
            weather_response = client.get(
                "https://api.openweathermap.org/data/2.5/weather", params=params
            )
            weather_response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        detail = exc.response.json().get("message", "Upstream error")
        return Response(
            {"detail": f"OpenWeather error: {detail}"},
            status=status_code,
        )
    except httpx.HTTPError as exc:
        return Response(
            {"detail": f"OpenWeather request failed: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    payload = weather_response.json()
    current_weather = payload.get("weather", [{}])[0]
    main = payload.get("main", {})
    wind = payload.get("wind", {})
    sys_info = payload.get("sys", {})

    formatted = {
        "location": payload.get("name") or location,
        "description": (current_weather.get("description") or "").title(),
        "temperature": main.get("temp"),
        "feels_like": main.get("feels_like"),
        "humidity": main.get("humidity"),
        "wind_speed": wind.get("speed"),
        "icon": current_weather.get("icon"),
        "sunrise": sys_info.get("sunrise"),
        "sunset": sys_info.get("sunset"),
        "timestamp": payload.get("dt"),
        "timezone_offset": payload.get("timezone"),
        "units": units,
        "resolved_at": timezone.now().isoformat(),
    }

    return Response(formatted)


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
