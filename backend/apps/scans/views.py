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

    # Add session_id to response
    recommendations["session_id"] = str(session_id)

    return Response(recommendations, status=status.HTTP_200_OK)
