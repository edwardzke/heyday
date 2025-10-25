"""HTTP API views for the core domain."""
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
