"""URL routes for scanning APIs."""
from django.urls import path

from . import views

urlpatterns = [
    path("sessions/", views.sessions, name="scan-session-create"),
    path("sessions/<uuid:session_id>/", views.session_detail, name="scan-session-detail"),
    path(
        "sessions/<uuid:session_id>/artifacts/",
        views.upload_artifact,
        name="scan-artifact-upload",
    ),
    path(
        "sessions/<uuid:session_id>/jobs/",
        views.start_processing,
        name="scan-processing-start",
    ),
    path(
        "sessions/<uuid:session_id>/generate-recommendations/",
        views.generate_recommendations,
        name="scan-generate-recommendations",
    ),
]
