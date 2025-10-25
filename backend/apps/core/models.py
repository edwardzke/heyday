"""Database models for the core domain."""
from django.db import models


class TimestampedModel(models.Model):
    """Abstract base model that tracks creation and update timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class HealthCheck(TimestampedModel):
    """Simple model used to verify connectivity between services."""

    status = models.CharField(max_length=32, default="ok")

    def __str__(self) -> str:
        return self.status
