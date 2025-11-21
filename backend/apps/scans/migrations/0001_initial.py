from django.db import migrations, models
import uuid
import apps.scans.models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="RoomScanSession",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("label", models.CharField(blank=True, max_length=128)),
                ("device_type", models.CharField(blank=True, max_length=64)),
                ("platform", models.CharField(blank=True, max_length=32)),
                ("app_version", models.CharField(blank=True, max_length=32)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("created", "Created"),
                            ("uploading", "Uploading"),
                            ("processing", "Processing"),
                            ("ready", "Ready"),
                            ("failed", "Failed"),
                        ],
                        default="created",
                        max_length=24,
                    ),
                ),
                ("notes", models.TextField(blank=True)),
                ("last_client_event_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="ProcessingJob",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("running", "Running"),
                            ("complete", "Complete"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=24,
                    ),
                ),
                ("message", models.TextField(blank=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="processing_jobs",
                        to="scans.roomscansession",
                    ),
                ),
            ],
            options={
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="ScanArtifact",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("raw_mesh", "Raw Mesh"),
                            ("processed_mesh", "Processed Mesh"),
                            ("floorplan", "Floorplan"),
                            ("camera_path", "Camera Path"),
                            ("screen_capture", "Screen Capture"),
                            ("metadata", "Metadata"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "upload_token",
                    models.CharField(
                        default=apps.scans.models.generate_upload_token,
                        max_length=48,
                        unique=True,
                    ),
                ),
                ("file", models.FileField(blank=True, upload_to=apps.scans.models._artifact_upload_path)),
                ("bytes", models.BigIntegerField(default=0)),
                ("checksum", models.CharField(blank=True, max_length=128)),
                ("content_type", models.CharField(blank=True, max_length=128)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("received", "Received"),
                            ("complete", "Complete"),
                            ("corrupt", "Corrupt"),
                        ],
                        default="received",
                        max_length=24,
                    ),
                ),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="artifacts",
                        to="scans.roomscansession",
                    ),
                ),
            ],
            options={
                "abstract": False,
            },
        ),
    ]
