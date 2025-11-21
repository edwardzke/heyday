"""Service helpers for handling scan artifacts and processing jobs."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile

from .models import ProcessingJob, RoomScanSession, ScanArtifact, generate_upload_token


@dataclass
class ArtifactChunk:
    session: RoomScanSession
    kind: str
    incoming_file: UploadedFile
    upload_token: str
    checksum: str | None
    chunk_index: int | None
    total_chunks: int | None

    @property
    def base_dir(self) -> Path:
        return Path(settings.MEDIA_ROOT) / "scans" / str(self.session.id)

    @property
    def extension(self) -> str:
        return Path(self.incoming_file.name or "").suffix or ".bin"

    @property
    def temp_path(self) -> Path:
        return self.base_dir / f"{self.upload_token}.part"

    @property
    def final_path(self) -> Path:
        return self.base_dir / f"{self.upload_token}{self.extension}"


def persist_artifact_chunk(chunk: ArtifactChunk) -> tuple[Optional[ScanArtifact], bool]:
    """Write an uploaded chunk to disk and finalize when complete."""
    chunk.base_dir.mkdir(parents=True, exist_ok=True)
    if chunk.chunk_index == 0:
        chunk.temp_path.unlink(missing_ok=True)

    with chunk.temp_path.open("ab") as destination:
        for data in chunk.incoming_file.chunks():
            destination.write(data)

    is_final = chunk.total_chunks is None or (
        chunk.chunk_index is not None
        and chunk.total_chunks is not None
        and chunk.chunk_index == chunk.total_chunks - 1
    )

    if not is_final:
        return None, False

    if chunk.temp_path != chunk.final_path:
        chunk.final_path.unlink(missing_ok=True)
        chunk.temp_path.replace(chunk.final_path)

    relative_path = chunk.final_path.relative_to(Path(settings.MEDIA_ROOT))
    artifact, _ = ScanArtifact.objects.get_or_create(
        session=chunk.session,
        upload_token=chunk.upload_token,
        defaults={
            "kind": chunk.kind,
            "status": ScanArtifact.Status.RECEIVED,
        },
    )
    artifact.kind = chunk.kind
    artifact.file.name = str(relative_path)
    artifact.bytes = chunk.final_path.stat().st_size
    artifact.content_type = chunk.incoming_file.content_type or ""
    artifact.checksum = chunk.checksum or artifact.checksum
    artifact.status = ScanArtifact.Status.COMPLETE
    artifact.save(
        update_fields=[
            "kind",
            "file",
            "bytes",
            "content_type",
            "checksum",
            "status",
            "updated_at",
        ]
    )
    return artifact, True


def enqueue_processing_job(session: RoomScanSession) -> ProcessingJob:
    """Create a processing job placeholder for a session."""
    job, _ = ProcessingJob.objects.get_or_create(
        session=session, status=ProcessingJob.Status.PENDING
    )
    session.status = RoomScanSession.Status.PROCESSING
    session.save(update_fields=["status", "updated_at"])
    return job
