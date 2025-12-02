"""Tests for floorplan recommendation engine."""
import json
import os
import unittest
from unittest.mock import patch, MagicMock

from . import floorPlanRecs


class TestFloorPlanRecommendations(unittest.TestCase):
    """Test cases for floorplan recommendation generation."""

    def setUp(self):
        """Load example RoomPlan JSON."""
        example_path = os.path.join(os.path.dirname(__file__), "Room.json")
        with open(example_path, "r") as f:
            self.example_roomplan = json.load(f)

    @patch('recommendationEngine.floorPlanRecs.supabase')
    @patch('recommendationEngine.floorPlanRecs.client')
    def test_get_recommendations_without_enrichment(self, mock_client, mock_supabase):
        """Test recommendation generation without Perenual enrichment."""
        # Mock Supabase user response
        mock_user_response = MagicMock()
        mock_user_response.data = [{
            "id": "test-user-id",
            "location": "San Francisco, CA",
            "plant_experience": "beginner",
            "style_preference": "modern",
            "toxicity_sensitivity": "pet_safe",
            "maintenance_level": "low"
        }]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_user_response

        # Mock Gemini response
        mock_gemini_response = MagicMock()
        mock_gemini_response.text = json.dumps({
            "Living Room": {
                "plants": [
                    {"name": "Snake Plant", "light_need": "Low to bright indirect", "watering": "Every 2-3 weeks"}
                ],
                "placement": "Near the window",
                "reasoning": "Low maintenance and air purifying"
            }
        })
        mock_client.responses.generate.return_value = mock_gemini_response

        result = floorPlanRecs.get_floor_plan_recommendations(
            user_id="test-user-id",
            roomplan_json=self.example_roomplan,
            window_orientation="S",
            enrich_perenual=False
        )

        self.assertEqual(result["user_id"], "test-user-id")
        self.assertEqual(result["window_orientation"], "S")
        self.assertEqual(result["source_model"], "gemini-2.5-flash")
        self.assertIn("Living Room", result["recommendations"])
        self.assertEqual(len(result["recommendations"]["Living Room"]["plants"]), 1)

        # Verify no Perenual enrichment
        plant = result["recommendations"]["Living Room"]["plants"][0]
        self.assertEqual(plant["name"], "Snake Plant")
        self.assertNotIn("perenual_data", plant)

    @patch('recommendationEngine.perenual_service.enrich_plant_with_perenual')
    @patch('recommendationEngine.floorPlanRecs.supabase')
    @patch('recommendationEngine.floorPlanRecs.client')
    def test_get_recommendations_with_enrichment(self, mock_client, mock_supabase, mock_enrich):
        """Test recommendation generation with Perenual enrichment."""
        # Mock Supabase user response
        mock_user_response = MagicMock()
        mock_user_response.data = [{
            "id": "test-user-id",
            "location": "New York, NY",
            "plant_experience": "intermediate",
            "style_preference": "tropical",
            "toxicity_sensitivity": "no_restrictions",
            "maintenance_level": "medium"
        }]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_user_response

        # Mock Gemini response
        mock_gemini_response = MagicMock()
        mock_gemini_response.text = json.dumps({
            "Bedroom": {
                "plants": [
                    {"name": "Monstera deliciosa", "light_need": "Bright indirect", "watering": "Weekly"}
                ],
                "placement": "Corner near east window",
                "reasoning": "Tropical aesthetic, medium maintenance"
            }
        })
        mock_client.responses.generate.return_value = mock_gemini_response

        # Mock Perenual enrichment
        mock_enrich.return_value = {
            "name": "monstera deliciosa",
            "perenual_id": 789,
            "common_name": "Swiss Cheese Plant",
            "scientific_name": "Monstera deliciosa",
            "watering_general_benchmark": "Average",
            "watering_interval_days": 7,
            "sunlight": "part shade",
            "maintenance_category": "Moderate",
            "poison_human": True,
            "poison_pets": True,
            "default_image_url": "https://example.com/monstera.jpg",
            "care_notes": "Water when soil is dry",
            "error": None
        }

        result = floorPlanRecs.get_floor_plan_recommendations(
            user_id="test-user-id",
            roomplan_json=self.example_roomplan,
            window_orientation="E",
            enrich_perenual=True
        )

        self.assertEqual(result["user_id"], "test-user-id")
        self.assertEqual(result["window_orientation"], "E")
        self.assertIn("Bedroom", result["recommendations"])

        # Verify Perenual enrichment is present
        plant = result["recommendations"]["Bedroom"]["plants"][0]
        self.assertEqual(plant["name"], "Monstera deliciosa")
        self.assertIn("perenual_data", plant)
        self.assertEqual(plant["perenual_data"]["perenual_id"], 789)
        self.assertEqual(plant["perenual_data"]["common_name"], "Swiss Cheese Plant")

        # Verify enrich function was called
        mock_enrich.assert_called_once_with("Monstera deliciosa")

    @patch('recommendationEngine.floorPlanRecs.supabase')
    def test_user_not_found(self, mock_supabase):
        """Test error when user is not found in Supabase."""
        # Mock empty Supabase response
        mock_user_response = MagicMock()
        mock_user_response.data = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_user_response

        with self.assertRaises(RuntimeError) as context:
            floorPlanRecs.get_floor_plan_recommendations(
                user_id="nonexistent-user-id",
                roomplan_json=self.example_roomplan
            )

        self.assertIn("not found", str(context.exception))

    @patch('recommendationEngine.floorPlanRecs.supabase')
    @patch('recommendationEngine.floorPlanRecs.client')
    def test_invalid_gemini_response(self, mock_client, mock_supabase):
        """Test handling of invalid JSON from Gemini."""
        # Mock Supabase user response
        mock_user_response = MagicMock()
        mock_user_response.data = [{"id": "test-user-id"}]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_user_response

        # Mock Gemini with invalid JSON
        mock_gemini_response = MagicMock()
        mock_gemini_response.text = "This is not valid JSON"
        mock_client.responses.generate.return_value = mock_gemini_response

        with self.assertRaises(RuntimeError) as context:
            floorPlanRecs.get_floor_plan_recommendations(
                user_id="test-user-id",
                roomplan_json=self.example_roomplan,
                enrich_perenual=False
            )

        self.assertIn("Failed to parse Gemini response", str(context.exception))

    def test_summarize_roomplan(self):
        """Test RoomPlan JSON summarization."""
        summary = floorPlanRecs._summarize_roomplan(self.example_roomplan, "N")

        self.assertIn("Doors:", summary)
        self.assertIn("Windows:", summary)
        self.assertIn("north-facing", summary)

    def test_load_example_roomplan(self):
        """Test loading the bundled Room.json example."""
        roomplan = floorPlanRecs._load_example_roomplan()

        self.assertIsInstance(roomplan, dict)
        self.assertIn("sections", roomplan)
        self.assertIn("doors", roomplan)
        self.assertIn("windows", roomplan)


if __name__ == "__main__":
    unittest.main()
