"""Data models for room scanning sessions and artifacts."""
from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.db import models

from apps.core.models import TimestampedModel


def generate_upload_token() -> str:
    """Return a stable token used to group chunked uploads."""
    return uuid4().hex


def _artifact_upload_path(instance: "ScanArtifact", filename: str) -> str:
    """Return a stable storage path for scan artifacts."""
    suffix = Path(filename).suffix or ".bin"
    return f"scans/{instance.session_id}/{instance.upload_token}{suffix}"


class RoomScanSession(TimestampedModel):
    """Logical container for a single room scanning session."""

    class Status(models.TextChoices):
        CREATED = "created", "Created"
        UPLOADING = "uploading", "Uploading"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    label = models.CharField(max_length=128, blank=True)
    device_type = models.CharField(max_length=64, blank=True)
    platform = models.CharField(max_length=32, blank=True)
    app_version = models.CharField(max_length=32, blank=True)
    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.CREATED
    )
    notes = models.TextField(blank=True)
    last_client_event_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"RoomScanSession<{self.id}>"


class ScanArtifact(TimestampedModel):
    """File artifact produced during or after scanning."""

    class Kind(models.TextChoices):
        RAW_MESH = "raw_mesh", "Raw Mesh"
        PROCESSED_MESH = "processed_mesh", "Processed Mesh"
        FLOORPLAN = "floorplan", "Floorplan"
        CAMERA_PATH = "camera_path", "Camera Path"
        SCREEN_CAPTURE = "screen_capture", "Screen Capture"
        METADATA = "metadata", "Metadata"
        ROOMPLAN_JSON = "roomplan_json", "RoomPlan JSON"

    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        COMPLETE = "complete", "Complete"
        CORRUPT = "corrupt", "Corrupt"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    session = models.ForeignKey(
        RoomScanSession,
        related_name="artifacts",
        on_delete=models.CASCADE,
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    upload_token = models.CharField(
        max_length=48, default=generate_upload_token, unique=True
    )
    file = models.FileField(upload_to=_artifact_upload_path, blank=True)
    bytes = models.BigIntegerField(default=0)
    checksum = models.CharField(max_length=128, blank=True)
    content_type = models.CharField(max_length=128, blank=True)
    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.RECEIVED
    )

    def __str__(self) -> str:
        return f"{self.kind} for session {self.session_id}"

    @property
    def relative_path(self) -> Path:
        """Return the artifact path relative to MEDIA_ROOT."""
        return Path(self.file.name)


class ProcessingJob(TimestampedModel):
    """Tracking record for mesh post-processing."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETE = "complete", "Complete"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    session = models.ForeignKey(
        RoomScanSession,
        related_name="processing_jobs",
        on_delete=models.CASCADE,
    )
    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.PENDING
    )
    message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def mark_running(self):
        self.status = self.Status.RUNNING
        self.save(update_fields=["status", "updated_at"])

    def mark_complete(self, message: str | None = None):
        self.status = self.Status.COMPLETE
        if message:
            self.message = message
        self.completed_at = self.completed_at or self.updated_at
        self.save(update_fields=["status", "message", "completed_at", "updated_at"])

    def mark_failed(self, message: str):
        self.status = self.Status.FAILED
        self.message = message
        self.completed_at = self.completed_at or self.updated_at
        self.save(update_fields=["status", "message", "completed_at", "updated_at"])

    def __str__(self) -> str:
        return f"ProcessingJob<{self.id}>"
