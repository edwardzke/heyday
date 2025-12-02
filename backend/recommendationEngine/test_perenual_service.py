"""Tests for Perenual API integration service."""
import os
import unittest
from unittest.mock import patch, MagicMock

from . import perenual_service


class TestPerenualService(unittest.TestCase):
    """Test cases for perenual_service module."""

    def setUp(self):
        """Clear cache before each test."""
        perenual_service.clear_cache()

    def test_enrich_empty_plant_name(self):
        """Test that empty plant name returns error."""
        result = perenual_service.enrich_plant_with_perenual("")

        self.assertEqual(result["name"], "")
        self.assertIsNone(result["perenual_id"])
        self.assertIsNotNone(result["error"])
        self.assertIn("Empty plant name", result["error"])

    @patch('recommendationEngine.perenual_service.requests.get')
    def test_enrich_no_results(self, mock_get):
        """Test handling when Perenual returns no results."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": []}
        mock_get.return_value = mock_response

        result = perenual_service.enrich_plant_with_perenual("NonexistentPlant123")

        self.assertEqual(result["name"], "nonexistentplant123")
        self.assertIsNone(result["perenual_id"])
        self.assertIsNotNone(result["error"])
        self.assertIn("No Perenual match found", result["error"])

    @patch('recommendationEngine.perenual_service.requests.get')
    def test_enrich_api_error(self, mock_get):
        """Test handling when Perenual API returns error."""
        mock_get.side_effect = Exception("API connection failed")

        result = perenual_service.enrich_plant_with_perenual("TestPlant")

        self.assertIsNotNone(result["error"])
        self.assertIn("Enrichment failed", result["error"])

    @patch('recommendationEngine.perenual_service.requests.get')
    def test_enrich_successful(self, mock_get):
        """Test successful plant enrichment."""
        # Mock search response
        search_response = MagicMock()
        search_response.status_code = 200
        search_response.json.return_value = {
            "data": [
                {
                    "id": 123,
                    "common_name": "Monstera",
                    "scientific_name": "Monstera deliciosa",
                    "other_name": ["Swiss Cheese Plant"]
                }
            ]
        }

        # Mock details response
        details_response = MagicMock()
        details_response.status_code = 200
        details_response.json.return_value = {
            "id": 123,
            "common_name": "Monstera",
            "scientific_name": "Monstera deliciosa",
            "watering": "Average",
            "sunlight": ["part shade"],
            "maintenance": "Low",
            "poisonous_to_humans": 1,
            "poisonous_to_pets": 1,
            "default_image": {
                "regular_url": "https://example.com/image.jpg"
            }
        }

        # Mock care guide response
        care_response = MagicMock()
        care_response.status_code = 200
        care_response.json.return_value = {
            "data": [
                {
                    "type": "Watering",
                    "description": "Water when top soil is dry"
                }
            ]
        }

        mock_get.side_effect = [search_response, details_response, care_response]

        result = perenual_service.enrich_plant_with_perenual("Monstera")

        self.assertEqual(result["perenual_id"], 123)
        self.assertEqual(result["common_name"], "Monstera")
        self.assertEqual(result["scientific_name"], "Monstera deliciosa")
        self.assertEqual(result["maintenance_category"], "Low")
        self.assertTrue(result["poison_human"])
        self.assertTrue(result["poison_pets"])
        self.assertEqual(result["default_image_url"], "https://example.com/image.jpg")
        self.assertIn("Watering:", result["care_notes"])
        self.assertIsNone(result["error"])

    @patch('recommendationEngine.perenual_service.requests.get')
    def test_cache_functionality(self, mock_get):
        """Test that results are cached on subsequent calls."""
        # Mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {"id": 456, "common_name": "Pothos", "scientific_name": "Epipremnum aureum"}
            ]
        }

        details_response = MagicMock()
        details_response.status_code = 200
        details_response.json.return_value = {
            "id": 456,
            "common_name": "Pothos",
            "scientific_name": "Epipremnum aureum",
            "default_image": {}
        }

        care_response = MagicMock()
        care_response.status_code = 200
        care_response.json.return_value = {"data": []}

        mock_get.side_effect = [mock_response, details_response, care_response]

        # First call - should hit API
        result1 = perenual_service.enrich_plant_with_perenual("Pothos")
        self.assertEqual(result1["perenual_id"], 456)
        self.assertEqual(mock_get.call_count, 3)

        # Second call - should use cache (no new API calls)
        result2 = perenual_service.enrich_plant_with_perenual("Pothos")
        self.assertEqual(result2["perenual_id"], 456)
        self.assertEqual(mock_get.call_count, 3)  # Still 3, not 6

        # Third call with different case - should use cache (normalized)
        result3 = perenual_service.enrich_plant_with_perenual("POTHOS")
        self.assertEqual(result3["perenual_id"], 456)
        self.assertEqual(mock_get.call_count, 3)  # Still 3

    def test_watering_interval_parsing(self):
        """Test watering interval day estimation."""
        with patch('recommendationEngine.perenual_service.requests.get') as mock_get:
            # Test "Frequent" watering
            search_resp = MagicMock()
            search_resp.status_code = 200
            search_resp.json.return_value = {"data": [{"id": 1, "common_name": "Test"}]}

            details_resp = MagicMock()
            details_resp.status_code = 200
            details_resp.json.return_value = {
                "id": 1,
                "common_name": "Test",
                "watering": "Frequent",
                "default_image": {}
            }

            care_resp = MagicMock()
            care_resp.status_code = 200
            care_resp.json.return_value = {"data": []}

            mock_get.side_effect = [search_resp, details_resp, care_resp]

            result = perenual_service.enrich_plant_with_perenual("FrequentPlant")
            self.assertEqual(result["watering_interval_days"], 1)


if __name__ == "__main__":
    unittest.main()
