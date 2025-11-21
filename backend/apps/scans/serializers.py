"""Serializers for scanning sessions and artifacts."""
from rest_framework import serializers

from .models import ProcessingJob, RoomScanSession, ScanArtifact


class ProcessingJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessingJob
        fields = [
            "id",
            "status",
            "message",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ScanArtifactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanArtifact
        fields = [
            "id",
            "kind",
            "upload_token",
            "status",
            "bytes",
            "checksum",
            "content_type",
            "file",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class RoomScanSessionSerializer(serializers.ModelSerializer):
    artifacts = ScanArtifactSerializer(many=True, read_only=True)
    processing_jobs = ProcessingJobSerializer(many=True, read_only=True)

    class Meta:
        model = RoomScanSession
        fields = [
            "id",
            "label",
            "device_type",
            "platform",
            "app_version",
            "status",
            "notes",
            "last_client_event_at",
            "artifacts",
            "processing_jobs",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "last_client_event_at",
            "artifacts",
            "processing_jobs",
            "created_at",
            "updated_at",
        ]


class CreateRoomScanSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomScanSession
        fields = ["label", "device_type", "platform", "app_version", "notes"]


class ArtifactUploadSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=ScanArtifact.Kind.choices)
    upload_token = serializers.CharField(required=False, allow_blank=True)
    checksum = serializers.CharField(required=False, allow_blank=True)
    chunk_index = serializers.IntegerField(required=False, min_value=0)
    total_chunks = serializers.IntegerField(required=False, min_value=1)
    file = serializers.FileField()

    def validate(self, attrs):
        chunk_index = attrs.get("chunk_index")
        total_chunks = attrs.get("total_chunks")
        if (chunk_index is None) ^ (total_chunks is None):
            raise serializers.ValidationError(
                "Provide both chunk_index and total_chunks, or neither for single-part uploads."
            )
        if total_chunks is not None and chunk_index is not None:
            if chunk_index >= total_chunks:
                raise serializers.ValidationError(
                    "chunk_index must be less than total_chunks."
                )
        return attrs


class FloorplanPointSerializer(serializers.Serializer):
    x = serializers.FloatField()
    y = serializers.FloatField()


class ManualFloorplanSerializer(serializers.Serializer):
    label = serializers.CharField(required=False, allow_blank=True)
    points = FloorplanPointSerializer(many=True)
    scale = serializers.FloatField(required=False, min_value=1e-6, default=1.0)

    def validate_points(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("Provide at least three points.")
        return value
