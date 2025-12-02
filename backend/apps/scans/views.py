"""HTTP views for AR room scanning."""
from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from recommendationEngine import floorPlanRecs

from .floorplan import generate_2d_floorplan_svg
from .models import ProcessingJob, RoomScanSession, ScanArtifact
from .serializers import (
    ArtifactUploadSerializer,
    CreateRoomScanSessionSerializer,
    ProcessingJobSerializer,
    RoomScanSessionSerializer,
    ScanArtifactSerializer,
)
from .services import ArtifactChunk, enqueue_processing_job, generate_upload_token, persist_artifact_chunk


@api_view(["GET", "POST"])
def sessions(request):
    """List existing sessions or create a new one."""
    if request.method == "POST":
        serializer = CreateRoomScanSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = RoomScanSession.objects.create(**serializer.validated_data)
        payload = RoomScanSessionSerializer(session).data
        return Response(payload, status=status.HTTP_201_CREATED)

    queryset = RoomScanSession.objects.order_by("-created_at")[:25]
    return Response(RoomScanSessionSerializer(queryset, many=True).data)


@api_view(["GET"])
def session_detail(_request, session_id):
    """Return session metadata, artifacts, and processing jobs."""
    session = get_object_or_404(RoomScanSession, id=session_id)
    return Response(RoomScanSessionSerializer(session).data)


@api_view(["POST"])
def upload_artifact(request, session_id):
    """Upload an artifact (chunked or single-part) for a session."""
    session = get_object_or_404(RoomScanSession, id=session_id)
    payload = ArtifactUploadSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    data = payload.validated_data

    upload_token = data.get("upload_token") or generate_upload_token()
    chunk = ArtifactChunk(
        session=session,
        kind=data["kind"],
        incoming_file=data["file"],
        upload_token=upload_token,
        checksum=data.get("checksum"),
        chunk_index=data.get("chunk_index"),
        total_chunks=data.get("total_chunks"),
    )

    if session.status == RoomScanSession.Status.CREATED:
        session.status = RoomScanSession.Status.UPLOADING
        session.save(update_fields=["status", "updated_at"])

    artifact, completed = persist_artifact_chunk(chunk)
    session.last_client_event_at = timezone.now()
    session.save(update_fields=["last_client_event_at", "updated_at"])

    response_body = {"upload_token": upload_token}
    if completed and artifact:
        response_body["artifact"] = ScanArtifactSerializer(artifact).data
        status_code = status.HTTP_201_CREATED
    else:
        status_code = status.HTTP_202_ACCEPTED

    return Response(response_body, status=status_code)


@api_view(["POST"])
def start_processing(request, session_id):
    """Create a processing job record; stubbed runner marks completion when requested."""
    session = get_object_or_404(RoomScanSession, id=session_id)
    auto_complete = str(request.data.get("auto_complete", "")).lower() in (
        "true",
        "1",
        "yes",
    )

    job = enqueue_processing_job(session)
    if auto_complete:
        job.status = ProcessingJob.Status.RUNNING
        job.save(update_fields=["status", "updated_at"])

        job.mark_complete(message="Processing stubbed on this environment.")
        session.status = RoomScanSession.Status.READY
        session.save(update_fields=["status", "updated_at"])

    return Response(
        {
            "job": ProcessingJobSerializer(job).data,
            "session": RoomScanSessionSerializer(session).data,
            "floorplan": None,
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["POST"])
def generate_recommendations(request, session_id):
    """
    Generate plant recommendations for a scanned room.

    Expects a RoomPlan JSON artifact to have been uploaded for this session.

    Request body:
        {
            "user_id": str (required) - Supabase user UUID,
            "window_orientation": str (optional) - N/S/E/W,
            "enrich_perenual": bool (optional, default true) - Fetch Perenual data
        }

    Response:
        {
            "session_id": str,
            "user_id": str,
            "roomplan_summary": str,
            "window_orientation": str | None,
            "source_model": str,
            "recommendations": {...}
        }
    """
    session = get_object_or_404(RoomScanSession, id=session_id)

    # Extract request parameters
    user_id = request.data.get("user_id")
    if not user_id:
        return Response(
            {"error": "user_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    window_orientation = request.data.get("window_orientation")
    enrich_perenual = request.data.get("enrich_perenual", True)

    # Find the RoomPlan JSON artifact
    roomplan_artifacts = session.artifacts.filter(
        kind=ScanArtifact.Kind.ROOMPLAN_JSON,
        status=ScanArtifact.Status.COMPLETE
    )

    if not roomplan_artifacts.exists():
        return Response(
            {"error": "No RoomPlan JSON artifact found for this session"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Load the RoomPlan JSON from the file
    artifact = roomplan_artifacts.first()
    roomplan_path = Path(settings.MEDIA_ROOT) / artifact.file.name

    try:
        with open(roomplan_path, "r") as f:
            roomplan_json = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        return Response(
            {"error": f"Failed to load RoomPlan JSON: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Generate 2D floorplan SVG
    floorplan_svg_url = None
    try:
        floorplan_svg = generate_2d_floorplan_svg(roomplan_json)

        # Save SVG as a new artifact
        from django.core.files.base import ContentFile
        svg_upload_token = generate_upload_token()
        svg_artifact = ScanArtifact.objects.create(
            session=session,
            kind=ScanArtifact.Kind.FLOORPLAN_SVG,
            upload_token=svg_upload_token,
            content_type="image/svg+xml",
            status=ScanArtifact.Status.COMPLETE,
        )
        svg_artifact.file.save(
            f"{svg_upload_token}.svg",
            ContentFile(floorplan_svg.encode('utf-8')),
            save=True
        )
        svg_artifact.bytes = len(floorplan_svg.encode('utf-8'))
        svg_artifact.save(update_fields=["bytes", "updated_at"])

        # Build URL to SVG file
        floorplan_svg_url = f"{settings.MEDIA_URL}{svg_artifact.file.name}"
    except Exception as e:
        # Log error but don't fail the request - floorplan is optional
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to generate floorplan SVG: {e}", exc_info=True)

    # Call the recommendation engine
    try:
        recommendations = floorPlanRecs.get_floor_plan_recommendations(
            user_id=user_id,
            roomplan_json=roomplan_json,
            window_orientation=window_orientation,
            enrich_perenual=enrich_perenual,
        )
    except Exception as e:
        return Response(
            {"error": f"Recommendation generation failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Add session_id and floorplan_svg_url to response
    recommendations["session_id"] = str(session_id)
    if floorplan_svg_url:
        recommendations["floorplan_svg_url"] = floorplan_svg_url

    return Response(recommendations, status=status.HTTP_200_OK)


@api_view(["POST"])
def cleanup_session(request, session_id):
    """
    Clean up Django session data after successfully saving to Supabase.

    This endpoint deletes all scan artifacts (files from media/) and the session record
    from the Django database after the mobile app has successfully persisted the data
    to Supabase.

    Request body: None required

    Response:
        {
            "message": "Session cleaned up successfully",
            "session_id": str,
            "artifacts_deleted": int
        }
    """
    session = get_object_or_404(RoomScanSession, id=session_id)

    # Count artifacts before deletion
    artifact_count = session.artifacts.count()

    # Delete all artifact files from filesystem and database
    for artifact in session.artifacts.all():
        try:
            # Delete file from filesystem
            if artifact.file:
                artifact.file.delete(save=False)
        except Exception as e:
            # Log but continue - don't fail cleanup if file already gone
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to delete artifact file {artifact.id}: {e}")

        # Delete artifact record
        artifact.delete()

    # Delete session record
    session.delete()

    return Response(
        {
            "message": "Session cleaned up successfully",
            "session_id": str(session_id),
            "artifacts_deleted": artifact_count,
        },
        status=status.HTTP_200_OK
    )
