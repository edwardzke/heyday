"""HTTP views for AR room scanning."""
from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import ProcessingJob, RoomScanSession, ScanArtifact
from .serializers import (
    ArtifactUploadSerializer,
    CreateRoomScanSessionSerializer,
    ManualFloorplanSerializer,
    ProcessingJobSerializer,
    RoomScanSessionSerializer,
    ScanArtifactSerializer,
)
from .services import ArtifactChunk, enqueue_processing_job, generate_upload_token, persist_artifact_chunk
from .floorplan import generate_floorplan, generate_floorplan_from_points


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
    want_floorplan = str(request.data.get("generate_floorplan", "")).lower() in (
        "true",
        "1",
        "yes",
    )
    floorplan_artifact = None

    job = enqueue_processing_job(session)
    if auto_complete:
        job.status = ProcessingJob.Status.RUNNING
        job.save(update_fields=["status", "updated_at"])
        floorplan_artifact = None
        if want_floorplan:
            try:
                floorplan_artifact = generate_floorplan(session)
            except Exception as exc:  # pylint: disable=broad-except
                job.mark_failed(message=f"Floorplan generation failed: {exc}")
                session.status = RoomScanSession.Status.FAILED
                session.save(update_fields=["status", "updated_at"])
                return Response(
                    {
                        "job": ProcessingJobSerializer(job).data,
                        "session": RoomScanSessionSerializer(session).data,
                        "error": str(exc),
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        job.mark_complete(message="Processing stubbed on this environment.")
        session.status = RoomScanSession.Status.READY
        session.save(update_fields=["status", "updated_at"])

    return Response(
        {
            "job": ProcessingJobSerializer(job).data,
            "session": RoomScanSessionSerializer(session).data,
            "floorplan": floorplan_artifact
            and ScanArtifactSerializer(floorplan_artifact).data,
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["POST"])
def manual_floorplan(request, session_id):
    """Allow users to submit a manual floorplan when automated generation fails."""
    session = get_object_or_404(RoomScanSession, id=session_id)
    payload = ManualFloorplanSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    points = [(pt["x"], pt["y"]) for pt in payload.validated_data["points"]]
    scale = float(payload.validated_data.get("scale") or 1.0)
    artifact = generate_floorplan_from_points(session, points, scale=scale)

    job = ProcessingJob.objects.create(
        session=session,
        status=ProcessingJob.Status.COMPLETE,
        message="Manual floorplan submitted",
        started_at=timezone.now(),
        completed_at=timezone.now(),
    )

    session.status = RoomScanSession.Status.READY
    if not session.label and payload.validated_data.get("label"):
        session.label = payload.validated_data["label"]
    session.save(update_fields=["status", "label", "updated_at"])

    return Response(
        {
            "session": RoomScanSessionSerializer(session).data,
            "floorplan": ScanArtifactSerializer(artifact).data,
            "job": ProcessingJobSerializer(job).data,
        },
        status=status.HTTP_201_CREATED,
    )
