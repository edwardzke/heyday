import importlib
import json
import os
from types import SimpleNamespace
from typing import Any
from unittest import TestCase, mock


class FakeSupabase:
    def __init__(self, user_payload=None):
        self._user_payload = user_payload or {"location": "Test City", "style_preference": "modern"}

    def table(self, _name: str) -> "FakeSupabase":
        return self

    def select(self, *_args, **_kwargs) -> "FakeSupabase":
        return self

    def eq(self, *_args, **_kwargs) -> "FakeSupabase":
        return self

    def maybe_single(self) -> Any:
        return SimpleNamespace(error=None, data=self._user_payload)


class FakeGeminiResponse:
    def __init__(self, text: str):
        self.text = text


class FakeGeminiClient:
    def __init__(self, api_key: str, response_text: str = '{"rooms": []}'):
        self.api_key = api_key
        self.responses = self
        self._response_text = response_text
        self.last_contents = None

    def generate(self, **kwargs):
        self.last_contents = kwargs.get("contents")
        return FakeGeminiResponse(self._response_text)


def _load_floor_module(fake_gemini: FakeGeminiClient):
    with mock.patch.dict(
        os.environ,
        {
            "GEMINI_API_KEY": "test-gemini",
            "SUPABASE_URL": "http://supabase.local",
            "SUPABASE_SERVICE_ROLE_KEY": "supabase-key",
        },
        clear=False,
    ), mock.patch("supabase.create_client", return_value=FakeSupabase()), mock.patch(
        "google.genai.Client", return_value=fake_gemini
    ):
        module = importlib.import_module("recommendationEngine.floorPlanRecs")
        return importlib.reload(module)


def _load_location_module(fake_gemini: FakeGeminiClient):
    with mock.patch.dict(
        os.environ,
        {
            "GEMINI_API_KEY": "test-gemini",
            "SUPABASE_URL": "http://supabase.local",
            "SUPABASE_SERVICE_ROLE_KEY": "supabase-key",
            "PERENUAL_API_KEY": "perenual-key",
        },
        clear=False,
    ), mock.patch("supabase.create_client", return_value=FakeSupabase()), mock.patch(
        "google.genai.Client", return_value=fake_gemini
    ):
        module = importlib.import_module("recommendationEngine.locationRecs")
        return importlib.reload(module)


class FloorPlanRecsTests(TestCase):
    def test_summary_includes_cardinal_orientation(self):
        fake_gemini = FakeGeminiClient("test")
        floor = _load_floor_module(fake_gemini)
        summary = floor._summarize_roomplan({"sections": [{"label": "livingRoom"}], "doors": [{}], "windows": [{}]}, "E")
        self.assertIn("east-facing", summary)
        self.assertIn("Rooms: livingRoom", summary)

    def test_get_floor_plan_recommendations_uses_gemini_json(self):
        fake_text = json.dumps({"rooms": [{"name": "livingRoom", "plants": ["Snake plant"]}]})
        fake_gemini = FakeGeminiClient("test", response_text=fake_text)
        floor = _load_floor_module(fake_gemini)
        result = floor.get_floor_plan_recommendations("user-1", {"sections": [], "doors": [], "windows": [], "objects": []}, "S")
        self.assertEqual(result, fake_text)
        # Ensure prompt was built
        self.assertIsNotNone(fake_gemini.last_contents)
        self.assertIn("Rooms:", fake_gemini.last_contents)


class PerenualIntegrationTests(TestCase):
    def test_enrich_with_perenual_success(self):
        fake_gemini = FakeGeminiClient("test")
        loc = _load_location_module(fake_gemini)

        search_payload = {
            "data": [
                {
                    "id": 42,
                    "common_name": "ZZ Plant",
                    "scientific_name": "Zamioculcas zamiifolia",
                    "sunlight": ["low light"],
                    "watering": "Low",
                    "cycle": "Perennial",
                }
            ]
        }
        detail_payload = {
            "id": 42,
            "sunlight": ["Indirect light"],
            "watering": "Low",
            "cycle": "Perennial",
            "default_image": {"regular_url": "https://img/zz.jpg"},
        }
        care_payload = {"data": [{"stage": "general", "care": "Water sparingly"}]}

        with mock.patch.object(loc, "requests") as mock_requests:
            mock_requests.get.side_effect = [
                SimpleNamespace(status_code=200, json=lambda: search_payload),
                SimpleNamespace(status_code=200, json=lambda: detail_payload),
                SimpleNamespace(status_code=200, json=lambda: care_payload),
            ]
            enriched = loc._enrich_with_perenual("ZZ Plant")

        self.assertEqual(enriched["perenual_match"]["id"], 42)
        self.assertEqual(enriched["perenual_match"]["common_name"], "ZZ Plant")
        self.assertIn("care_instructions", enriched["perenual_match"])

    def test_enrich_with_perenual_handles_error(self):
        fake_gemini = FakeGeminiClient("test")
        loc = _load_location_module(fake_gemini)

        with mock.patch.object(loc, "requests") as mock_requests:
            mock_requests.get.return_value = SimpleNamespace(status_code=500, text="boom", json=lambda: {})
            enriched = loc._enrich_with_perenual("Unknown Plant")

        self.assertIsNone(enriched["perenual_match"])
        self.assertIn("error", enriched)
