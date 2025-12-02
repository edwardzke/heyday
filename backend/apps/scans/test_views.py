"""Tests for scan views and recommendation generation endpoint."""
import json
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.conf import settings
from rest_framework.test import APIClient

from .models import RoomScanSession, ScanArtifact


class GenerateRecommendationsViewTest(TestCase):
    """Test cases for the generate_recommendations view."""

    def setUp(self):
        """Set up test client and test session."""
        self.client = APIClient()
        self.session = RoomScanSession.objects.create(
            label="Test Scan",
            device_type="ios",
            platform="mobile"
        )

    def test_missing_user_id(self):
        """Test that missing user_id returns 400 Bad Request."""
        url = f"/api/scans/sessions/{self.session.id}/generate-recommendations/"
        response = self.client.post(url, {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)
        self.assertIn("user_id", response.data["error"])

    def test_missing_roomplan_artifact(self):
        """Test that missing RoomPlan JSON artifact returns 404."""
        url = f"/api/scans/sessions/{self.session.id}/generate-recommendations/"
        response = self.client.post(
            url,
            {"user_id": "test-user-123"},
            format="json"
        )

        self.assertEqual(response.status_code, 404)
        self.assertIn("error", response.data)
        self.assertIn("No RoomPlan JSON artifact", response.data["error"])

    def test_nonexistent_session(self):
        """Test that nonexistent session returns 404."""
        url = "/api/scans/sessions/00000000-0000-0000-0000-000000000000/generate-recommendations/"
        response = self.client.post(
            url,
            {"user_id": "test-user-123"},
            format="json"
        )

        self.assertEqual(response.status_code, 404)

    @patch('apps.scans.views.floorPlanRecs.get_floor_plan_recommendations')
    def test_successful_recommendation_generation(self, mock_get_recommendations):
        """Test successful recommendation generation flow."""
        # Create RoomPlan JSON artifact
        roomplan_data = {
            "sections": [{"label": "Living Room"}],
            "doors": [{"id": 1}],
            "windows": [{"id": 1}],
            "objects": []
        }

        # Write RoomPlan JSON to file
        artifact = ScanArtifact.objects.create(
            session=self.session,
            kind=ScanArtifact.Kind.ROOMPLAN_JSON,
            status=ScanArtifact.Status.COMPLETE
        )

        # Create the file in media directory
        media_path = Path(settings.MEDIA_ROOT) / artifact.file.name
        media_path.parent.mkdir(parents=True, exist_ok=True)
        with open(media_path, "w") as f:
            json.dump(roomplan_data, f)

        try:
            # Mock recommendation engine response
            mock_get_recommendations.return_value = {
                "user_id": "test-user-123",
                "roomplan_summary": "Test summary",
                "window_orientation": "S",
                "source_model": "gemini-2.5-flash",
                "recommendations": {
                    "Living Room": {
                        "plants": [
                            {
                                "name": "Snake Plant",
                                "light_need": "Low",
                                "watering": "Minimal",
                                "perenual_data": {
                                    "perenual_id": 123,
                                    "common_name": "Snake Plant"
                                }
                            }
                        ],
                        "placement": "Corner",
                        "reasoning": "Low maintenance"
                    }
                }
            }

            url = f"/api/scans/sessions/{self.session.id}/generate-recommendations/"
            response = self.client.post(
                url,
                {
                    "user_id": "test-user-123",
                    "window_orientation": "S",
                    "enrich_perenual": True
                },
                format="json"
            )

            self.assertEqual(response.status_code, 200)
            self.assertIn("session_id", response.data)
            self.assertEqual(response.data["session_id"], str(self.session.id))
            self.assertIn("recommendations", response.data)
            self.assertIn("Living Room", response.data["recommendations"])

            # Verify recommendation engine was called correctly
            mock_get_recommendations.assert_called_once()
            call_args = mock_get_recommendations.call_args
            self.assertEqual(call_args.kwargs["user_id"], "test-user-123")
            self.assertEqual(call_args.kwargs["window_orientation"], "S")
            self.assertTrue(call_args.kwargs["enrich_perenual"])

        finally:
            # Clean up test file
            if media_path.exists():
                media_path.unlink()

    @patch('apps.scans.views.floorPlanRecs.get_floor_plan_recommendations')
    def test_recommendation_engine_error(self, mock_get_recommendations):
        """Test handling when recommendation engine raises error."""
        # Create artifact with file
        artifact = ScanArtifact.objects.create(
            session=self.session,
            kind=ScanArtifact.Kind.ROOMPLAN_JSON,
            status=ScanArtifact.Status.COMPLETE
        )

        media_path = Path(settings.MEDIA_ROOT) / artifact.file.name
        media_path.parent.mkdir(parents=True, exist_ok=True)
        with open(media_path, "w") as f:
            json.dump({"sections": []}, f)

        try:
            # Mock recommendation engine to raise error
            mock_get_recommendations.side_effect = Exception("Gemini API error")

            url = f"/api/scans/sessions/{self.session.id}/generate-recommendations/"
            response = self.client.post(
                url,
                {"user_id": "test-user-123"},
                format="json"
            )

            self.assertEqual(response.status_code, 500)
            self.assertIn("error", response.data)
            self.assertIn("Recommendation generation failed", response.data["error"])

        finally:
            if media_path.exists():
                media_path.unlink()


class ScanSessionViewsTest(TestCase):
    """Test cases for scan session CRUD operations."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    def test_create_session(self):
        """Test creating a new scan session."""
        response = self.client.post(
            "/api/scans/sessions/",
            {
                "label": "My Room Scan",
                "device_type": "ios",
                "platform": "mobile"
            },
            format="json"
        )

        self.assertEqual(response.status_code, 201)
        self.assertIn("id", response.data)
        self.assertEqual(response.data["label"], "My Room Scan")
        self.assertEqual(response.data["status"], "created")

    def test_get_session_detail(self):
        """Test retrieving session details."""
        session = RoomScanSession.objects.create(
            label="Test Session",
            device_type="android"
        )

        response = self.client.get(f"/api/scans/sessions/{session.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(session.id))
        self.assertEqual(response.data["label"], "Test Session")

    def test_list_sessions(self):
        """Test listing scan sessions."""
        RoomScanSession.objects.create(label="Session 1")
        RoomScanSession.objects.create(label="Session 2")

        response = self.client.get("/api/scans/sessions/")

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 2)


if __name__ == "__main__":
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'heyday_backend.settings')
    django.setup()

    from django.test.utils import get_runner
    from django.conf import settings

    TestRunner = get_runner(settings)
    test_runner = TestRunner()
    failures = test_runner.run_tests(["apps.scans.test_views"])
