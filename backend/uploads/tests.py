import os
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from uploads import views


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class ClassifyPlantViewTests(TestCase):
    def tearDown(self):
        views._get_perenual_enrichment_cached.cache_clear()

    def _make_photo(self):
        return SimpleUploadedFile("leaf.jpg", b"fake-content", content_type="image/jpeg")

    def test_classify_enriches_with_perenual_data(self):
        with mock.patch.dict(
            os.environ,
            {"PLANTNET_API_KEY": "plantnet-key", "PERENUAL_API_KEY": "perenual-key"},
            clear=False,
        ), mock.patch("uploads.views.requests.post") as mock_post, mock.patch(
            "uploads.views.requests.get"
        ) as mock_get:
            plantnet_payload = {
                "results": [
                    {
                        "species": {
                            "scientificNameWithoutAuthor": "Ficus lyrata",
                            "commonNames": ["Fiddle Leaf Fig"],
                        },
                        "score": 0.91,
                    }
                ]
            }
            perenual_search = {
                "data": [
                    {
                        "id": 42,
                        "scientific_name": "Ficus lyrata",
                        "other_name": ["Fiddle Leaf Fig"],
                    }
                ]
            }
            perenual_detail = {
                "id": 42,
                "common_name": "Fiddle Leaf Fig",
                "scientific_name": "Ficus lyrata",
                "family": "Moraceae",
                "origin": ["Tropical Africa"],
                "type": "houseplant",
                "cycle": "Perennial",
                "watering": "Average",
                "sunlight": ["Bright indirect light"],
                "other_name": ["Fiddle Leaf Fig"],
                "pruning_month": ["March"],
                "maintenance": "Moderate",
                "watering_general_benchmark": {"value": "keep lightly moist"},
            }

            mock_post.return_value = FakeResponse(200, plantnet_payload)
            mock_get.side_effect = [
                FakeResponse(200, perenual_search),
                FakeResponse(200, perenual_detail),
            ]

            response = self.client.post(
                reverse("classify_plant"), {"photo": self._make_photo()}
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["class"], "Ficus lyrata")
        self.assertEqual(payload["common_name"], "Fiddle Leaf Fig")
        self.assertIn("perenual", payload)
        self.assertEqual(payload["perenual"]["species"]["id"], 42)
        self.assertEqual(payload["perenual"]["care"]["watering"], "Average")

    def test_classify_handles_perenual_failure_gracefully(self):
        with mock.patch.dict(
            os.environ,
            {"PLANTNET_API_KEY": "plantnet-key", "PERENUAL_API_KEY": "perenual-key"},
            clear=False,
        ), mock.patch("uploads.views.requests.post") as mock_post, mock.patch(
            "uploads.views.requests.get"
        ) as mock_get:
            plantnet_payload = {
                "results": [
                    {
                        "species": {
                            "scientificNameWithoutAuthor": "Ficus elastica",
                            "commonNames": ["Rubber Plant"],
                        },
                        "score": 0.85,
                    }
                ]
            }
            mock_post.return_value = FakeResponse(200, plantnet_payload)
            mock_get.return_value = FakeResponse(500, {"error": "unavailable"})

            response = self.client.post(
                reverse("classify_plant"), {"photo": self._make_photo()}
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["class"], "Ficus elastica")
        self.assertEqual(payload["common_name"], "Rubber Plant")
        self.assertNotIn("perenual", payload)
