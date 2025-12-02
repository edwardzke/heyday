# Floorplan Recommendation Integration Plan (Updated v2)

## Overview

This plan details the integration of AR room scanning (RoomPlan JSON) with the plant recommendation engine and Perenual API to provide users with personalized, location-aware plant recommendations for their scanned spaces.

**Key Integration**: Connect mobile RoomPlan AR scanning → Django backend → Gemini AI recommendations → Perenual enrichment → Supabase persistence → Mobile display

---

## Architecture

```
Mobile App (RoomPlan AR Scan)
    ↓ ARRoomScanner.scanRoom()
    Returns: { roomJson }  (USDZ files NOT used)
    ↓
Upload RoomPlan JSON to Django Backend
    ↓ POST /api/scans/sessions/{id}/artifacts/
    Store: RoomPlan JSON as ScanArtifact (kind: roomplan_json)
    ↓
Generate Recommendations
    ↓ POST /api/scans/sessions/{id}/generate-recommendations/
    Process: floorPlanRecs.get_floor_plan_recommendations()
    ↓
    ├─→ Fetch user from Supabase users table (display_name, device_platform)
    ├─→ Gemini AI (plant names + placement per room)
    └─→ Perenual API (care instructions + images)
    ↓
Persist to Supabase
    ↓ INSERT into floorplans table
    ↓ INSERT into plant_recommendations table (with recommended_location JSONB)
    ↓ Optional: INSERT into plants catalog (dedupe by perenual_id)
    ↓
Return to Mobile
    ↓ JSON response with enriched recommendations
    Mobile displays via existing hooks (useFloorplans, usePlantRecommendations)
```

---

## Current State Analysis

### What Exists

#### 1. **Django Backend** (`backend/`)
- **Models** (`apps/scans/models.py`):
  - `RoomScanSession`: Tracks scan sessions with status flow (created → uploading → processing → ready/failed)
    - Fields: `id` (UUID), `label`, `device_type`, `platform`, `app_version`, `status`, `notes`, `last_client_event_at`
  - `ScanArtifact`: Stores uploaded files with chunked upload support
    - Fields: `id` (UUID), `session` (FK), `kind` (choices: raw_mesh, processed_mesh, floorplan, camera_path, screen_capture, metadata), `upload_token`, `file`, `bytes`, `checksum`, `content_type`, `status`
    - **MISSING**: No `roomplan_json` kind yet
  - `ProcessingJob`: Async job tracking
    - Fields: `id` (UUID), `session` (FK), `status`, `message`, `started_at`, `completed_at`

- **API Endpoints** (`apps/scans/views.py`) - **CURRENTLY COMMENTED OUT**:
  - `GET/POST /api/scans/sessions/` - List/create sessions
  - `GET /api/scans/sessions/{id}/` - Session detail
  - `POST /api/scans/sessions/{id}/artifacts/` - Upload artifacts (supports chunked uploads)
  - `POST /api/scans/sessions/{id}/jobs/` - Start processing job
  - **MISSING**: No `/generate-recommendations/` endpoint

- **Serializers** (`apps/scans/serializers.py`):
  - `RoomScanSessionSerializer`: Full session with nested artifacts/jobs
  - `CreateRoomScanSessionSerializer`: Write-only session creation
  - `ArtifactUploadSerializer`: Supports chunked uploads with `chunk_index`, `total_chunks`
  - `ScanArtifactSerializer`: Read-only artifact details

#### 2. **Recommendation Engine** (`backend/recommendationEngine/`)
- **floorPlanRecs.py**:
  - `get_floor_plan_recommendations(user_id, roomplan_json, window_orientation)` → Returns raw Gemini JSON string
  - Fetches user from Supabase `users` table
  - Normalizes RoomPlan JSON → Gemini prompt → JSON response
  - **MISSING**: No Perenual enrichment, returns raw string instead of structured dict

- **locationRecs.py**:
  - `get_location_recommendations(user_id, limit, model)` → Returns enriched dict
  - Includes `_enrich_with_perenual(plant_name)` function that:
    - Searches Perenual `/species-list`
    - Fetches `/species/details/{id}`
    - Fetches `/species-care-guide/{id}`
    - Returns combined data with care, images, scientific names

#### 3. **Supabase Tables** (Mobile app uses these - see `HeydayMobile/supabase-schema-new.sql`)

**users** - User profiles (extends auth.users)
- `id` (UUID, PK, FK to auth.users)
- `display_name` (TEXT)
- `device_platform` (TEXT, default: 'ios')
- `device_token` (TEXT)
- `created_at` (TIMESTAMPTZ)

**plants** - Global plant catalog (read-only for clients)
- `id` (UUID, PK)
- `perenual_id` (INTEGER) - External API reference
- `common_name` (TEXT)
- `scientific_name` (TEXT)
- `description` (TEXT)
- `watering_general_benchmark` (TEXT) - e.g., "once per week"
- `watering_interval_days` (INTEGER) - Structured version
- `sunlight` (TEXT) - e.g., "full_sun", "partial_shade"
- `maintenance_category` (TEXT) - "low", "medium", "high"
- `soil_type` (TEXT)
- `poison_human` (BOOLEAN)
- `poison_pets` (BOOLEAN)
- `default_image_url` (TEXT)
- `care_notes` (TEXT)
- `created_at` (TIMESTAMPTZ)

**floorplans** - User's room layouts
- `id` (UUID, PK)
- `user_id` (UUID, FK to users, cascade delete)
- `name` (TEXT) - e.g., "Living Room", "My Apartment"
- `roomplan_json` (JSONB) - Raw RoomPlan structure
- `created_at` (TIMESTAMPTZ)
- **Index**: `idx_floorplans_user_id`

**plant_recommendations** - AI-generated plant suggestions
- `id` (UUID, PK)
- `user_id` (UUID, FK to users, cascade delete)
- `plant_id` (UUID, FK to plants, set null on delete)
- `floorplan_id` (UUID, FK to floorplans, cascade delete)
- `source` (TEXT) - e.g., "gemini", "manual"
- `score` (NUMERIC) - Confidence score 0-1
- `reason` (TEXT) - Explanation from AI
- `recommended_location` (JSONB) - `{ "room": "living room", "x": 10, "y": 42, "placement": "near window", "light_need": "bright indirect", "watering": "weekly" }`
- `status` (TEXT, constraint: 'pending' | 'accepted' | 'dismissed', default: 'pending')
- `created_at` (TIMESTAMPTZ)
- `accepted_at` (TIMESTAMPTZ)
- `dismissed_at` (TIMESTAMPTZ)
- **Indexes**: `idx_plant_recs_user_id`, `idx_plant_recs_floorplan_id`, `idx_plant_recs_plant_id`

**user_plants** - User's owned plants placed in floorplans
- `id` (UUID, PK)
- `user_id` (UUID, FK to users, cascade delete)
- `plant_id` (UUID, FK to plants, set null on delete)
- `floorplan_id` (UUID, FK to floorplans, cascade delete)
- `nickname` (TEXT) - User-given name
- `notes` (TEXT)
- `x_coord` (NUMERIC) - Position in floorplan
- `y_coord` (NUMERIC)
- `location_meta` (JSONB) - e.g., `{ "room": "Living Room" }`
- `started_at` (DATE) - When plant was added
- `watering_frequency_days` (INTEGER) - Override default
- `last_watered_at` (DATE)
- `next_water_at` (DATE)
- `photos` (JSONB, default: '[]') - Array of `{ "image_url", "taken_at", "notes" }`
- `created_at` (TIMESTAMPTZ)
- **Indexes**: `idx_user_plants_user_id`, `idx_user_plants_floorplan_id`, `idx_user_plants_plant_id`

#### 4. **Mobile App** (`HeydayMobile/`)
- **RoomPlan Scanner** (`app/roomscan.tsx`):
  - Calls `ARRoomScanner.scanRoom()` (native iOS module)
  - Returns `{ roomJson: string }` (USDZ path is available but NOT used)
  - **TODO (lines 40-54)**: Upload to backend (commented out)

- **Supabase Hooks**:
  - `useFloorplans()`: CRUD operations on floorplans table
  - `usePlantRecommendations()`: CRUD operations on plant_recommendations table
  - `usePlantsCatalog()`: Fetch plants catalog (read-only)
  - `useUserPlants()`: Manage user's plant collection
  - `useSupabaseUser()`: Auth state management

- **Authentication**: Uses Supabase Auth with email/password
  - Session stored in secure storage
  - `user.id` available via `supabase.auth.getUser()`

### What's Missing

1. ✗ **Django**: `ScanArtifact.Kind.ROOMPLAN_JSON` choice
2. ✗ **Django**: `/api/scans/sessions/{id}/generate-recommendations/` endpoint
3. ✗ **Django**: Scans URLs uncommented in `heyday_backend/urls.py:14`
4. ✗ **Recommendation Engine**: Perenual enrichment in `floorPlanRecs.py`
5. ✗ **Recommendation Engine**: Structured dict return instead of JSON string
6. ✗ **Mobile**: Upload implementation in `roomscan.tsx`
7. ✗ **Mobile**: Persist recommendations to Supabase `floorplans` and `plant_recommendations` tables
8. ✗ **Mobile**: Display recommendations using existing hooks
9. ✗ **Supabase**: User preferences fields in `users` table (location, experience, style preferences)

---

## Implementation Steps

### Phase 0: Supabase Schema Updates (Prerequisites)

#### Step 0.1: Add User Preferences to Supabase `users` Table

**Action**: Extend the `users` table to store plant preferences for recommendation engine

**SQL Migration** (run in Supabase SQL Editor):
```sql
-- Add user preference columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS plant_experience TEXT DEFAULT 'beginner' CHECK (plant_experience IN ('beginner', 'intermediate', 'expert')),
ADD COLUMN IF NOT EXISTS style_preference TEXT DEFAULT 'modern',
ADD COLUMN IF NOT EXISTS toxicity_sensitivity TEXT DEFAULT 'pet_safe',
ADD COLUMN IF NOT EXISTS maintenance_level TEXT DEFAULT 'low';

-- Add index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(location);
```

**Update TypeScript types** (`HeydayMobile/lib/supabase.ts`):
```typescript
export interface User {
  id: string;
  display_name: string | null;
  device_platform: string;
  device_token: string | null;
  location: string | null;
  plant_experience: 'beginner' | 'intermediate' | 'expert';
  style_preference: string | null;
  toxicity_sensitivity: string | null;
  maintenance_level: string | null;
  created_at: string;
}
```

**Rationale**: The recommendation engine needs user preferences from Supabase. Currently, these fields don't exist in the `users` table.

---

### Phase 1: Backend Foundation (Django)

#### Step 1.1: Add ROOMPLAN_JSON Artifact Kind
**File**: `backend/apps/scans/models.py`

**Current**:
```python
class Kind(models.TextChoices):
    RAW_MESH = "raw_mesh", "Raw mesh"
    PROCESSED_MESH = "processed_mesh", "Processed mesh"
    FLOORPLAN = "floorplan", "Floorplan"
    CAMERA_PATH = "camera_path", "Camera path"
    SCREEN_CAPTURE = "screen_capture", "Screen capture"
    METADATA = "metadata", "Metadata"
```

**Add**:
```python
ROOMPLAN_JSON = "roomplan_json", "RoomPlan JSON"
```

**Migration**: Run `python manage.py makemigrations` and `python manage.py migrate`

---

#### Step 1.2: Centralize Perenual Enrichment Logic
**File**: `backend/recommendationEngine/perenual_service.py` (NEW)

**Purpose**: DRY - avoid duplicating Perenual logic between `locationRecs.py` and new floorplan enrichment. Match Supabase `plants` table schema exactly.

**Implementation**:
```python
"""
Centralized Perenual API integration for plant data enrichment.
Returns data matching Supabase plants table schema exactly.
"""
import os
import requests
from typing import Dict, Any, Optional
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

PERENUAL_API_KEY = os.getenv("PERENUAL_API_KEY")
PERENUAL_BASE = "https://perenual.com/api"

def enrich_plant_with_perenual(plant_name: str) -> Dict[str, Any]:
    """
    Search Perenual for plant by name, fetch details + care guide.

    Returns schema matching Supabase plants table exactly:
    {
        "name": str (original Gemini name),
        "perenual_id": int | None,
        "common_name": str | None,
        "scientific_name": str | None,
        "description": str | None,
        "watering_general_benchmark": str | None,  # e.g., "once per week"
        "watering_interval_days": int | None,
        "sunlight": str | None,  # e.g., "full_sun", "partial_shade"
        "maintenance_category": str | None,  # "low", "medium", "high"
        "soil_type": str | None,
        "poison_human": bool | None,
        "poison_pets": bool | None,
        "default_image_url": str | None,
        "care_notes": str | None,
        "error": str | None
    }
    """
    try:
        species_id = _search_perenual(plant_name.lower())
        if not species_id:
            return {
                "name": plant_name,
                "perenual_id": None,
                "common_name": plant_name,
                "error": "No Perenual match found"
            }

        details = _get_perenual_details(species_id)
        care = _get_perenual_care(species_id)

        # Extract watering interval from care benchmark
        watering_benchmark = details.get("watering_general_benchmark", {})
        watering_value = watering_benchmark.get("value", "") if isinstance(watering_benchmark, dict) else ""
        watering_interval = None

        if watering_value:
            # Parse "7-10" → average 8.5 days
            parts = watering_value.split("-")
            if len(parts) == 2:
                try:
                    watering_interval = int((int(parts[0]) + int(parts[1])) / 2)
                except ValueError:
                    pass
            elif parts[0].isdigit():
                watering_interval = int(parts[0])

        # Map Perenual sunlight array to single string
        sunlight_list = details.get("sunlight", [])
        sunlight = sunlight_list[0] if sunlight_list else None

        # Extract maintenance level
        maintenance = details.get("maintenance", "").lower()
        if "low" in maintenance:
            maintenance_category = "low"
        elif "high" in maintenance:
            maintenance_category = "high"
        else:
            maintenance_category = "medium"

        return {
            "name": plant_name,
            "perenual_id": species_id,
            "common_name": details.get("common_name") or plant_name,
            "scientific_name": details.get("scientific_name"),
            "description": details.get("description"),
            "watering_general_benchmark": watering_value or details.get("watering"),
            "watering_interval_days": watering_interval,
            "sunlight": sunlight,
            "maintenance_category": maintenance_category,
            "soil_type": None,  # Perenual doesn't provide this
            "poison_human": details.get("poisonous_to_humans") == 1,
            "poison_pets": details.get("poisonous_to_pets") == 1,
            "default_image_url": (details.get("default_image") or {}).get("regular_url"),
            "care_notes": _format_care_notes(care.get("data", [])),
            "error": None
        }
    except Exception as e:
        return {
            "name": plant_name,
            "perenual_id": None,
            "common_name": plant_name,
            "error": str(e)
        }

@lru_cache(maxsize=256)
def _search_perenual(plant_name_lower: str) -> Optional[int]:
    """Search Perenual /species-list, return first match species ID."""
    if not PERENUAL_API_KEY:
        raise RuntimeError("PERENUAL_API_KEY not set")

    resp = requests.get(
        f"{PERENUAL_BASE}/species-list",
        params={"key": PERENUAL_API_KEY, "q": plant_name_lower, "page": 1},
        timeout=10
    )
    if resp.status_code >= 400:
        return None

    data = resp.json()
    candidates = data.get("data", [])
    if not candidates:
        return None

    return candidates[0].get("id")

def _get_perenual_details(species_id: int) -> Dict[str, Any]:
    """Fetch /species/details/{id}."""
    resp = requests.get(
        f"{PERENUAL_BASE}/species/details/{species_id}",
        params={"key": PERENUAL_API_KEY},
        timeout=10
    )
    if resp.status_code >= 400:
        return {}
    return resp.json()

def _get_perenual_care(species_id: int) -> Dict[str, Any]:
    """Fetch /species-care-guide/{id}."""
    resp = requests.get(
        f"{PERENUAL_BASE}/species-care-guide/{species_id}",
        params={"key": PERENUAL_API_KEY},
        timeout=10
    )
    if resp.status_code >= 400:
        return {}
    return resp.json()

def _format_care_notes(care_sections: list) -> str:
    """Format care guide sections into readable notes."""
    if not care_sections:
        return ""

    notes = []
    for section in care_sections:
        section_type = section.get("type", "")
        description = section.get("description", "")
        if section_type and description:
            notes.append(f"{section_type.title()}: {description}")

    return "\n\n".join(notes)
```

**Rationale**:
- Matches Supabase `plants` table schema exactly
- LRU caching reduces API calls
- Error-tolerant (returns partial data on failure)
- Reusable across all recommendation flows

---

#### Step 1.3: Update floorPlanRecs to Return Enriched Dict
**File**: `backend/recommendationEngine/floorPlanRecs.py`

**Current behavior**: Returns raw Gemini JSON string

**New behavior**: Parse Gemini JSON → enrich with Perenual → return structured dict

**Changes**:
```python
import json
from django.utils import timezone
from .perenual_service import enrich_plant_with_perenual

def get_floor_plan_recommendations(
    user_id: str,
    roomplan_json: Optional[Dict[str, Any]] = None,
    window_orientation: Optional[str] = None,
    enrich_perenual: bool = True  # NEW PARAMETER
) -> Dict[str, Any]:
    """
    Generate plant recommendations for a RoomPlan JSON.

    Returns:
    {
        "user_id": str,
        "floorplan_summary": str,
        "recommendations": {
            "livingRoom": {
                "room_type": "livingRoom",
                "plants": [
                    {
                        "name": "Pothos",
                        "light_need": "low to medium indirect",
                        "watering": "allow soil to dry between waterings",
                        "placement": "corner shelf or hanging basket",
                        "reasoning": "Pothos thrives in low light...",
                        "perenual": { ...enrichment data... } | None
                    },
                    ...
                ],
                "placement_notes": "..."
            },
            ...
        },
        "metadata": {
            "model": "gemini-2.5-flash",
            "timestamp": "2025-12-01T...",
            "window_orientation": "N" | null,
            "perenual_enriched": true,
            "total_plants_recommended": 8
        }
    }
    """
    # Existing logic: Fetch user, normalize RoomPlan, build prompt
    resp = supabase.table("users").select("*").eq("id", user_id).maybe_single()
    if resp.error:
        raise RuntimeError(f"Supabase error: {resp.error}")
    user = resp.data or {}

    plan = roomplan_json or _load_example_roomplan()
    prompt = _build_prompt(user, plan, window_orientation)

    # Call Gemini (existing)
    gemini_json_str = _call_gemini(prompt)

    # NEW: Parse and validate JSON
    try:
        gemini_data = json.loads(gemini_json_str)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid Gemini JSON response: {e}")

    # NEW: Enrich each plant with Perenual data
    total_plants = 0
    if enrich_perenual:
        for room_name, room_data in gemini_data.items():
            if not isinstance(room_data, dict):
                continue

            plants = room_data.get("plants", [])
            for plant in plants:
                plant_name = plant.get("name")
                if plant_name:
                    plant["perenual"] = enrich_plant_with_perenual(plant_name)
                    total_plants += 1
    else:
        # Count plants without enriching
        for room_data in gemini_data.values():
            if isinstance(room_data, dict):
                total_plants += len(room_data.get("plants", []))

    # NEW: Add metadata wrapper
    return {
        "user_id": user_id,
        "floorplan_summary": _summarize_roomplan(plan, window_orientation),
        "recommendations": gemini_data,
        "metadata": {
            "model": "gemini-2.5-flash",
            "timestamp": timezone.now().isoformat(),
            "window_orientation": window_orientation,
            "perenual_enriched": enrich_perenual,
            "total_plants_recommended": total_plants
        }
    }
```

**Rationale**:
- Returns structured dict instead of raw JSON string
- Enriches Gemini plant names with Perenual data (care, images, scientific names)
- Adds metadata for tracking and debugging
- Matches expected format for Supabase persistence

---

#### Step 1.4: Create Recommendations API Endpoint
**File**: `backend/apps/scans/views.py`

**Add new view function**:
```python
import json
from django.utils import timezone
from recommendationEngine.floorPlanRecs import get_floor_plan_recommendations

@api_view(["POST"])
def generate_recommendations(request, session_id):
    """
    Generate plant recommendations for a scanned room.

    Expects RoomPlan JSON artifact already uploaded to session.
    Fetches user preferences from Supabase, generates recommendations,
    returns enriched data ready for mobile display.

    Request body:
    {
        "user_id": "uuid" (required),
        "window_orientation": "N" | "S" | "E" | "W" (optional),
        "enrich_perenual": true (optional, default true)
    }

    Response (200):
    {
        "session_id": "uuid",
        "user_id": "uuid",
        "floorplan_summary": "Rooms: livingRoom, kitchen...",
        "recommendations": { ...per-room plant recommendations... },
        "metadata": { ...model, timestamp, enrichment status... }
    }

    Errors:
    - 404: Session or RoomPlan JSON artifact not found
    - 400: Missing user_id
    - 500: Recommendation generation failed
    """
    session = get_object_or_404(RoomScanSession, id=session_id)

    # 1. Find RoomPlan JSON artifact (most recent complete)
    roomplan_artifact = session.artifacts.filter(
        kind=ScanArtifact.Kind.ROOMPLAN_JSON,
        status=ScanArtifact.Status.COMPLETE
    ).order_by("-created_at").first()

    if not roomplan_artifact:
        return Response(
            {
                "error": "No RoomPlan JSON artifact found for this session",
                "hint": "Upload RoomPlan JSON before generating recommendations"
            },
            status=status.HTTP_404_NOT_FOUND
        )

    # 2. Load RoomPlan JSON from file storage
    try:
        with open(roomplan_artifact.file.path, "r") as f:
            roomplan_json = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        return Response(
            {"error": f"Failed to read RoomPlan JSON: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # 3. Extract request parameters
    user_id = request.data.get("user_id")
    if not user_id:
        return Response(
            {"error": "user_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    window_orientation = request.data.get("window_orientation")  # N, S, E, W
    enrich_perenual = request.data.get("enrich_perenual", True)

    # 4. Generate recommendations (calls Gemini + Perenual)
    try:
        result = get_floor_plan_recommendations(
            user_id=user_id,
            roomplan_json=roomplan_json,
            window_orientation=window_orientation,
            enrich_perenual=enrich_perenual
        )
    except RuntimeError as e:
        # Gemini/Supabase/Perenual API errors
        return Response(
            {"error": f"Recommendation generation failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        # Unexpected errors
        import traceback
        traceback.print_exc()
        return Response(
            {"error": f"Unexpected error: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # 5. Update session status
    session.status = RoomScanSession.Status.READY
    session.last_client_event_at = timezone.now()
    session.save(update_fields=["status", "last_client_event_at", "updated_at"])

    # 6. Return enriched recommendations
    return Response(
        {
            "session_id": str(session.id),
            **result  # Includes user_id, floorplan_summary, recommendations, metadata
        },
        status=status.HTTP_200_OK
    )
```

**Rationale**:
- RESTful endpoint tied to scan session
- Validates artifact exists before processing
- Handles all error scenarios gracefully
- Returns data ready for Supabase persistence

---

#### Step 1.5: Register URL Routes
**File**: `backend/apps/scans/urls.py`

**Current**:
```python
urlpatterns = [
    path("sessions/", views.sessions, name="sessions"),
    path("sessions/<uuid:session_id>/", views.session_detail, name="session-detail"),
    path("sessions/<uuid:session_id>/artifacts/", views.upload_artifact, name="upload-artifact"),
    path("sessions/<uuid:session_id>/jobs/", views.start_processing, name="start-processing"),
]
```

**Add**:
```python
path(
    "sessions/<uuid:session_id>/generate-recommendations/",
    views.generate_recommendations,
    name="generate-recommendations"
),
```

**File**: `backend/heyday_backend/urls.py`

**Change line 14** from:
```python
#path("api/scans/", include("apps.scans.urls")),
```

**To**:
```python
path("api/scans/", include("apps.scans.urls")),
```

**Rationale**: Enable scans API at `/api/scans/sessions/{id}/generate-recommendations/`

---

### Phase 2: Mobile Client Integration

#### Step 2.1: Upload RoomPlan JSON to Backend
**File**: `HeydayMobile/app/roomscan.tsx`

**Current**: Lines 40-54 are commented out TODO

**New Implementation**:
```typescript
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { NativeModules } from "react-native";
import { supabase } from "../lib/supabase";

const { ARRoomScanner } = NativeModules;
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function RoomScanPage() {
  const router = useRouter();
  const [uploadProgress, setUploadProgress] = useState("Scanning room...");

  useEffect(() => {
    (async () => {
      try {
        // 1) Get authenticated user ID
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          Alert.alert("Error", "Please sign in to scan rooms");
          router.back();
          return;
        }
        const userId = user.id;

        // 2) Scan room (native iOS RoomPlan)
        setUploadProgress("Scanning room...");
        const payloadString: string = await ARRoomScanner.scanRoom();

        let payload: any;
        try {
          payload = JSON.parse(payloadString);
        } catch (err) {
          console.error("❌ Failed to parse payload:", err);
          Alert.alert("Scan error", "Invalid data returned from scanner.");
          router.back();
          return;
        }

        if (payload.error) {
          throw new Error(payload.error);
        }

        // NOTE: usdzPath is available in payload but NOT used
        const roomJson: string | undefined = payload.roomJson;

        console.log("🟢 roomJson length:", roomJson?.length);

        // 3) Create scan session on Django backend
        setUploadProgress("Creating session...");
        const sessionResp = await fetch(`${BACKEND_URL}/api/scans/sessions/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: `Room Scan ${new Date().toLocaleString()}`,
            device_type: "iOS",
            platform: "expo",
            app_version: "1.0.0"
          })
        });

        if (!sessionResp.ok) {
          throw new Error(`Failed to create session: ${sessionResp.status}`);
        }

        const sessionData = await sessionResp.json();
        const sessionId = sessionData.id;
        console.log("✅ Session created:", sessionId);

        // 4) Upload RoomPlan JSON (required for recommendations)
        setUploadProgress("Uploading floor plan...");
        const jsonFormData = new FormData();

        // Create blob from JSON string
        const jsonBlob = new Blob([roomJson || "{}"], { type: "application/json" });
        jsonFormData.append("file", jsonBlob, "roomplan.json");
        jsonFormData.append("kind", "roomplan_json");

        const jsonResp = await fetch(
          `${BACKEND_URL}/api/scans/sessions/${sessionId}/artifacts/`,
          { method: "POST", body: jsonFormData }
        );

        if (!jsonResp.ok) {
          throw new Error(`RoomPlan JSON upload failed: ${jsonResp.status}`);
        }
        console.log("✅ RoomPlan JSON uploaded");

        // 5) Generate recommendations (Gemini + Perenual)
        setUploadProgress("Generating recommendations...");
        const recsResp = await fetch(
          `${BACKEND_URL}/api/scans/sessions/${sessionId}/generate-recommendations/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              window_orientation: null,  // TODO: detect from compass or ask user
              enrich_perenual: true
            })
          }
        );

        if (!recsResp.ok) {
          const errorData = await recsResp.json().catch(() => ({}));
          throw new Error(errorData.error || `Recommendations failed: ${recsResp.status}`);
        }

        const recommendations = await recsResp.json();
        console.log("✅ Recommendations generated:", recommendations.metadata);

        // 6) Save to Supabase floorplans + plant_recommendations tables
        setUploadProgress("Saving recommendations...");
        const floorplanId = await saveRecommendationsToSupabase(
          userId,
          roomJson || "{}",
          recommendations,
          sessionId
        );

        // 7) Navigate to recommendations view
        Alert.alert(
          "Scan Complete!",
          `Generated ${recommendations.metadata.total_plants_recommended} plant recommendations`
        );
        router.replace({
          pathname: "/recommendations/[floorplanId]",
          params: { floorplanId }
        });

      } catch (e: any) {
        if (e?.code === "CANCELLED") {
          router.back();
          return;
        }
        console.error("❌ Room scan failed:", e);
        Alert.alert("Scan failed", e?.message ?? "Unknown error");
        router.back();
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>{uploadProgress}</Text>
    </View>
  );
}

/**
 * Save recommendations to Supabase floorplans + plant_recommendations tables.
 * This enables the mobile app to display recommendations using existing hooks.
 *
 * Returns the created floorplan ID.
 */
async function saveRecommendationsToSupabase(
  userId: string,
  roomJsonStr: string,
  recommendations: any,
  sessionId: string
): Promise<string> {
  // 1. Save floorplan
  const { data: floorplan, error: floorplanError } = await supabase
    .from("floorplans")
    .insert({
      user_id: userId,
      name: `Scan ${new Date().toLocaleDateString()}`,
      roomplan_json: JSON.parse(roomJsonStr)
    })
    .select()
    .single();

  if (floorplanError) {
    console.error("❌ Failed to save floorplan:", floorplanError);
    throw new Error("Failed to save floorplan to Supabase");
  }

  const floorplanId = floorplan.id;
  console.log("✅ Floorplan saved:", floorplanId);

  // 2. Optional: Populate plants catalog with Perenual data (dedupe by perenual_id)
  const catalogInserts = [];
  const perenualIdMap = new Map<number, string>(); // perenual_id → plant_id

  for (const [roomName, roomData] of Object.entries(recommendations.recommendations)) {
    const plants = (roomData as any).plants || [];
    for (const plant of plants) {
      const perenual = plant.perenual;
      if (perenual && perenual.perenual_id && !perenual.error) {
        // Check if we've already seen this perenual_id
        if (!perenualIdMap.has(perenual.perenual_id)) {
          catalogInserts.push({
            perenual_id: perenual.perenual_id,
            common_name: perenual.common_name,
            scientific_name: perenual.scientific_name,
            description: perenual.description,
            watering_general_benchmark: perenual.watering_general_benchmark,
            watering_interval_days: perenual.watering_interval_days,
            sunlight: perenual.sunlight,
            maintenance_category: perenual.maintenance_category,
            soil_type: perenual.soil_type,
            poison_human: perenual.poison_human,
            poison_pets: perenual.poison_pets,
            default_image_url: perenual.default_image_url,
            care_notes: perenual.care_notes
          });
        }
      }
    }
  }

  // Bulk upsert to plants catalog (upsert on perenual_id conflict)
  if (catalogInserts.length > 0) {
    const { data: catalogData, error: catalogError } = await supabase
      .from("plants")
      .upsert(catalogInserts, {
        onConflict: "perenual_id",
        ignoreDuplicates: false
      })
      .select("id, perenual_id");

    if (catalogError) {
      console.warn("⚠️ Failed to populate plant catalog:", catalogError);
      // Don't throw - catalog population is optional
    } else {
      // Build perenual_id → plant_id map
      catalogData?.forEach(p => {
        if (p.perenual_id) {
          perenualIdMap.set(p.perenual_id, p.id);
        }
      });
      console.log(`✅ Populated ${catalogData?.length || 0} plants in catalog`);
    }
  }

  // 3. Save plant recommendations (flatten room → plants structure)
  const recommendationRows = [];
  for (const [roomName, roomData] of Object.entries(recommendations.recommendations)) {
    const plants = (roomData as any).plants || [];
    for (const plant of plants) {
      // Try to link to plants catalog if we have perenual_id
      let plant_id = null;
      if (plant.perenual?.perenual_id) {
        plant_id = perenualIdMap.get(plant.perenual.perenual_id) || null;
      }

      recommendationRows.push({
        user_id: userId,
        floorplan_id: floorplanId,
        plant_id,  // May be null if catalog insert failed
        source: "gemini",
        score: 0.8,  // Default score
        reason: plant.reasoning || "",
        recommended_location: {
          room: roomName,
          placement: plant.placement,
          light_need: plant.light_need,
          watering: plant.watering,
          // Include Perenual data for display even if not in catalog
          plant_name: plant.name,
          scientific_name: plant.perenual?.scientific_name,
          default_image_url: plant.perenual?.default_image_url,
          care_notes: plant.perenual?.care_notes,
          sunlight: plant.perenual?.sunlight,
          watering_interval_days: plant.perenual?.watering_interval_days,
          maintenance_category: plant.perenual?.maintenance_category,
          poison_human: plant.perenual?.poison_human,
          poison_pets: plant.perenual?.poison_pets
        },
        status: "pending"
      });
    }
  }

  if (recommendationRows.length > 0) {
    const { error: recsError } = await supabase
      .from("plant_recommendations")
      .insert(recommendationRows);

    if (recsError) {
      console.error("❌ Failed to save recommendations:", recsError);
      throw new Error("Failed to save recommendations to Supabase");
    }
    console.log(`✅ Saved ${recommendationRows.length} plant recommendations`);
  }

  return floorplanId;
}
```

**Environment Variable**:
Add to `HeydayMobile/.env`:
```
EXPO_PUBLIC_BACKEND_URL=http://YOUR_IP:8000
```

**Rationale**:
- NO USDZ files used - only RoomPlan JSON
- Uses Supabase auth for user ID
- Uploads to Django backend (scans API)
- Saves enriched recommendations to Supabase (enables existing hooks)
- Populates plants catalog with Perenual data (dedupe by perenual_id)
- Stores full Perenual data in recommended_location JSONB for display
- Shows progress feedback to user

---

#### Step 2.2: Display Recommendations Using Existing Hooks
**File**: `HeydayMobile/app/recommendations/[floorplanId].tsx` (NEW)

**Create dedicated recommendations screen**:

```typescript
import { useLocalSearchParams } from "expo-router";
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from "react-native";
import { usePlantRecommendations } from "../../hooks/usePlantRecommendations";
import { useFloorplans } from "../../hooks/useFloorplans";
import { supabase } from "../../lib/supabase";

export default function RecommendationsScreen() {
  const { floorplanId } = useLocalSearchParams();
  const { data: recommendations, isLoading } = usePlantRecommendations();
  const { data: floorplans } = useFloorplans();

  const floorplan = floorplans?.find(f => f.id === floorplanId);
  const floorplanRecs = recommendations?.filter(
    r => r.floorplan_id === floorplanId && r.status === "pending"
  ) || [];

  // Group by room
  const byRoom = floorplanRecs.reduce((acc, rec) => {
    const room = rec.recommended_location?.room || "Other";
    if (!acc[room]) acc[room] = [];
    acc[room].push(rec);
    return acc;
  }, {} as Record<string, any[]>);

  const handleAccept = async (rec: any) => {
    // Update recommendation status to accepted
    const { error: statusError } = await supabase
      .from("plant_recommendations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString()
      })
      .eq("id", rec.id);

    if (statusError) {
      console.error("Failed to accept recommendation:", statusError);
      return;
    }

    // Add to user_plants table
    const location = rec.recommended_location || {};
    const { error: plantError } = await supabase
      .from("user_plants")
      .insert({
        user_id: rec.user_id,
        plant_id: rec.plant_id,
        floorplan_id: rec.floorplan_id,
        nickname: location.plant_name || "New Plant",
        notes: rec.reason,
        location_meta: {
          room: location.room,
          placement: location.placement
        },
        watering_frequency_days: location.watering_interval_days,
        started_at: new Date().toISOString().split('T')[0]
      });

    if (plantError) {
      console.error("Failed to add to garden:", plantError);
    }
  };

  const handleDismiss = async (recId: string) => {
    const { error } = await supabase
      .from("plant_recommendations")
      .update({
        status: "dismissed",
        dismissed_at: new Date().toISOString()
      })
      .eq("id", recId);

    if (error) {
      console.error("Failed to dismiss recommendation:", error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading recommendations...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        Plant Recommendations for {floorplan?.name || "Your Space"}
      </Text>

      {Object.entries(byRoom).map(([roomName, recs]) => (
        <View key={roomName} style={styles.roomSection}>
          <Text style={styles.roomHeader}>{roomName}</Text>

          {recs.map(rec => {
            const location = rec.recommended_location || {};
            return (
              <View key={rec.id} style={styles.plantCard}>
                {/* Plant image from Perenual if available */}
                {location.default_image_url && (
                  <Image
                    source={{ uri: location.default_image_url }}
                    style={styles.plantImage}
                  />
                )}

                <View style={styles.plantInfo}>
                  <Text style={styles.plantName}>{location.plant_name || "Unknown"}</Text>
                  <Text style={styles.scientificName}>{location.scientific_name}</Text>

                  <View style={styles.detailsRow}>
                    <Text style={styles.detail}>💡 {location.light_need || location.sunlight}</Text>
                    <Text style={styles.detail}>💧 {location.watering || `Every ${location.watering_interval_days} days`}</Text>
                  </View>

                  <View style={styles.detailsRow}>
                    <Text style={styles.detail}>📍 {location.placement}</Text>
                    <Text style={styles.detail}>
                      🔧 {location.maintenance_category || "medium"} maintenance
                    </Text>
                  </View>

                  {location.poison_pets && (
                    <Text style={styles.warning}>⚠️ Toxic to pets</Text>
                  )}

                  <Text style={styles.reason}>{rec.reason}</Text>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAccept(rec)}
                    >
                      <Text style={styles.buttonText}>✓ Add to Garden</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={() => handleDismiss(rec.id)}
                    >
                      <Text style={styles.buttonText}>✗ Not Interested</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      {floorplanRecs.length === 0 && (
        <Text style={styles.emptyMessage}>
          No pending recommendations. Scan a room to get started!
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  roomSection: { marginBottom: 24 },
  roomHeader: { fontSize: 20, fontWeight: "600", marginBottom: 12, color: "#2e7d32" },
  plantCard: { flexDirection: "row", marginBottom: 16, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 },
  plantImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
  plantInfo: { flex: 1 },
  plantName: { fontSize: 18, fontWeight: "600" },
  scientificName: { fontSize: 14, fontStyle: "italic", color: "#666", marginBottom: 8 },
  detailsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  detail: { fontSize: 13, color: "#555" },
  warning: { fontSize: 13, color: "#d32f2f", fontWeight: "600", marginBottom: 4 },
  reason: { fontSize: 13, color: "#555", marginTop: 8, marginBottom: 12, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 8 },
  acceptButton: { flex: 1, padding: 10, backgroundColor: "#4CAF50", borderRadius: 6 },
  dismissButton: { flex: 1, padding: 10, backgroundColor: "#f44336", borderRadius: 6 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "600" },
  emptyMessage: { textAlign: "center", marginTop: 32, fontSize: 16, color: "#999" }
});
```

**Rationale**:
- Leverages existing `usePlantRecommendations()` and `useFloorplans()` hooks
- Groups recommendations by room
- Allows user to accept (adds to user_plants) or dismiss
- Displays all Perenual data (images, care instructions, toxicity warnings)
- Updates recommendation status in Supabase on accept/dismiss

---

### Phase 3: Testing & Validation

#### Step 3.1: Backend Unit Tests
**File**: `backend/recommendationEngine/tests.py`

**Add tests**:
```python
import unittest
from unittest.mock import patch, MagicMock
from .perenual_service import enrich_plant_with_perenual
from .floorPlanRecs import get_floor_plan_recommendations

class PerenualServiceTests(unittest.TestCase):
    @patch('recommendationEngine.perenual_service.requests.get')
    def test_enrich_plant_success(self, mock_get):
        # Mock search response
        search_resp = MagicMock()
        search_resp.status_code = 200
        search_resp.json.return_value = {
            "data": [{"id": 123, "common_name": "Golden Pothos"}]
        }

        # Mock details response
        details_resp = MagicMock()
        details_resp.status_code = 200
        details_resp.json.return_value = {
            "id": 123,
            "common_name": "Golden Pothos",
            "scientific_name": "Epipremnum aureum",
            "sunlight": ["part shade"],
            "watering": "Average",
            "maintenance": "Low",
            "default_image": {"regular_url": "https://example.com/pothos.jpg"}
        }

        # Mock care response
        care_resp = MagicMock()
        care_resp.status_code = 200
        care_resp.json.return_value = {"data": []}

        mock_get.side_effect = [search_resp, details_resp, care_resp]

        result = enrich_plant_with_perenual("Pothos")

        self.assertEqual(result["perenual_id"], 123)
        self.assertEqual(result["common_name"], "Golden Pothos")
        self.assertEqual(result["scientific_name"], "Epipremnum aureum")
        self.assertIsNone(result["error"])

    @patch('recommendationEngine.perenual_service.requests.get')
    def test_enrich_plant_not_found(self, mock_get):
        # Mock empty search result
        search_resp = MagicMock()
        search_resp.status_code = 200
        search_resp.json.return_value = {"data": []}

        mock_get.return_value = search_resp

        result = enrich_plant_with_perenual("NonexistentPlant")

        self.assertIsNone(result["perenual_id"])
        self.assertEqual(result["common_name"], "NonexistentPlant")
        self.assertIn("error", result)

class FloorPlanRecommendationsTests(unittest.TestCase):
    @patch('recommendationEngine.floorPlanRecs.supabase')
    @patch('recommendationEngine.floorPlanRecs._call_gemini')
    @patch('recommendationEngine.floorPlanRecs.enrich_plant_with_perenual')
    def test_get_recommendations_with_enrichment(self, mock_enrich, mock_gemini, mock_supabase):
        # Mock Supabase user fetch
        mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = MagicMock(
            error=None,
            data={
                "location": "SF",
                "plant_experience": "beginner",
                "style_preference": "modern",
                "toxicity_sensitivity": "pet_safe",
                "maintenance_level": "low"
            }
        )

        # Mock Gemini response
        mock_gemini.return_value = '{"livingRoom": {"plants": [{"name": "Pothos", "placement": "shelf"}]}}'

        # Mock Perenual enrichment
        mock_enrich.return_value = {
            "perenual_id": 123,
            "common_name": "Golden Pothos",
            "scientific_name": "Epipremnum aureum"
        }

        result = get_floor_plan_recommendations(
            user_id="test-user-123",
            roomplan_json={"sections": [{"label": "livingRoom"}]},
            enrich_perenual=True
        )

        self.assertEqual(result["user_id"], "test-user-123")
        self.assertIn("recommendations", result)
        self.assertIn("metadata", result)
        self.assertTrue(result["metadata"]["perenual_enriched"])
        self.assertEqual(result["recommendations"]["livingRoom"]["plants"][0]["perenual"]["perenual_id"], 123)
```

---

#### Step 3.2: Manual Testing Checklist

**Backend**:
- [ ] Environment variables set: `GEMINI_API_KEY`, `PERENUAL_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Django migrations applied: `python manage.py migrate`
- [ ] Scans API uncommented in `heyday_backend/urls.py:14`
- [ ] Test Perenual enrichment: Run `python -m recommendationEngine.perenual_service` with test data
- [ ] Test floorPlan recommendations: Use example Room.json
- [ ] API endpoint accessible: `curl -X POST http://localhost:8000/api/scans/sessions/{id}/generate-recommendations/`

**Supabase**:
- [ ] User preferences columns added to `users` table
- [ ] Test user has preferences set (location, plant_experience, etc.)
- [ ] `plants` table has unique constraint on `perenual_id` for upsert logic
- [ ] RLS policies allow users to read/write their own floorplans and recommendations

**Mobile**:
- [ ] Environment variable `EXPO_PUBLIC_BACKEND_URL` set to local IP
- [ ] User authenticated via Supabase
- [ ] RoomPlan scan completes successfully (iOS device, not simulator)
- [ ] RoomPlan JSON uploaded to backend (check Django `media/scans/` directory)
- [ ] Recommendations saved to Supabase `floorplans` and `plant_recommendations` tables
- [ ] Plants catalog populated with Perenual data (check `plants` table)
- [ ] Recommendations screen displays pending recommendations grouped by room
- [ ] Accept action: adds to `user_plants` and updates recommendation status to "accepted"
- [ ] Dismiss action: updates recommendation status to "dismissed"
- [ ] Perenual images load correctly

**End-to-End Flow**:
1. Open mobile app → Sign in
2. Navigate to room scan screen
3. Complete RoomPlan AR scan (iOS device required)
4. Wait for upload + recommendation generation (15-30 seconds)
5. Navigate to recommendations screen for the new floorplan
6. See pending plant recommendations grouped by room with images
7. Accept a recommendation → plant added to `user_plants` table
8. Dismiss a recommendation → status updated to dismissed
9. Navigate to dashboard → see user_plants displayed

---

### Phase 4: Optimization & Polish

#### Step 4.1: Django Caching for Perenual
**File**: `backend/recommendationEngine/perenual_service.py`

**Add Django cache integration**:
```python
from django.core.cache import cache

def enrich_plant_with_perenual(plant_name: str) -> Dict[str, Any]:
    # Check cache first
    cache_key = f"perenual:{plant_name.lower()}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # ... existing enrichment logic ...

    # Cache result for 7 days
    if result.get("perenual_id"):  # Only cache successful matches
        cache.set(cache_key, result, timeout=86400 * 7)

    return result
```

**Configure Django cache** (`settings.py`):
```python
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "perenual-cache",
        "OPTIONS": {
            "MAX_ENTRIES": 1000
        }
    }
}
```

**For production**: Use Redis instead of LocMemCache

---

#### Step 4.2: Error Handling & Fallbacks
**File**: `backend/recommendationEngine/floorPlanRecs.py`

**Add graceful degradation**:
```python
import logging

logger = logging.getLogger(__name__)

def get_floor_plan_recommendations(...):
    # ... existing code ...

    # Enrich with Perenual (allow partial failures)
    if enrich_perenual:
        for room_name, room_data in gemini_data.items():
            if not isinstance(room_data, dict):
                continue

            plants = room_data.get("plants", [])
            for plant in plants:
                plant_name = plant.get("name")
                if plant_name:
                    try:
                        plant["perenual"] = enrich_plant_with_perenual(plant_name)
                    except Exception as e:
                        # Log error but continue with minimal data
                        logger.warning(f"Perenual enrichment failed for {plant_name}: {e}")
                        plant["perenual"] = {
                            "name": plant_name,
                            "common_name": plant_name,
                            "error": "Enrichment unavailable"
                        }

    # ... rest of function ...
```

---

## Updated Data Flow

### 1. Mobile → Django (Upload)
```
ARRoomScanner.scanRoom()
  ↓
{ roomJson: "{...}" }  (USDZ path ignored)
  ↓
POST /api/scans/sessions/ → { id: "session-uuid", status: "created" }
  ↓
POST /api/scans/sessions/{id}/artifacts/ (JSON file, kind: "roomplan_json")
  ↓
Response: { upload_token: "...", artifact: { id, status: "complete" } }
```

### 2. Django → Gemini → Perenual (Processing)
```
POST /api/scans/sessions/{id}/generate-recommendations/
  Body: { user_id, window_orientation?, enrich_perenual? }
  ↓
Load RoomPlan JSON from artifact.file
  ↓
floorPlanRecs.get_floor_plan_recommendations()
  ↓
  ├─ Fetch user from Supabase users table (with new preference fields)
  ├─ Normalize RoomPlan JSON → room summary
  ├─ Call Gemini API (gemini-2.5-flash)
  │    Prompt: room summary + user preferences
  │    Response: { livingRoom: { plants: [...] }, kitchen: { plants: [...] } }
  ├─ For each plant name:
  │    └─ enrich_plant_with_perenual()
  │         ├─ Check Django cache first
  │         ├─ Search Perenual /species-list
  │         ├─ Fetch /species/details/{id}
  │         ├─ Fetch /species-care-guide/{id}
  │         ├─ Cache result
  │         └─ Return enriched data matching Supabase plants schema
  └─ Return structured dict
  ↓
Response: { session_id, user_id, floorplan_summary, recommendations, metadata }
```

### 3. Mobile → Supabase (Persistence)
```
saveRecommendationsToSupabase()
  ↓
INSERT INTO floorplans (user_id, name, roomplan_json)
  ↓
floorplanId
  ↓
UPSERT INTO plants (perenual_id, common_name, ...) ON CONFLICT (perenual_id)
  ↓
Build perenual_id → plant_id map
  ↓
For each room → plants:
  INSERT INTO plant_recommendations (
    user_id,
    floorplan_id,
    plant_id: matched from catalog or null,
    source: "gemini",
    reason: plant.reasoning,
    recommended_location: {
      room, placement, light_need, watering,
      plant_name, scientific_name, default_image_url,
      care_notes, sunlight, watering_interval_days,
      maintenance_category, poison_human, poison_pets
    },
    status: "pending"
  )
  ↓
Navigate to /recommendations/[floorplanId]
  ↓
usePlantRecommendations() hook fetches pending recommendations
  ↓
Display recommendations grouped by room with full Perenual data
```

---

## API Endpoints Reference

### `POST /api/scans/sessions/`
**Create new scan session**

**Request**:
```json
{
  "label": "Living Room Scan",
  "device_type": "iOS",
  "platform": "expo",
  "app_version": "1.0.0"
}
```

**Response (201)**:
```json
{
  "id": "uuid",
  "label": "Living Room Scan",
  "device_type": "iOS",
  "platform": "expo",
  "app_version": "1.0.0",
  "status": "created",
  "notes": "",
  "last_client_event_at": null,
  "artifacts": [],
  "processing_jobs": [],
  "created_at": "2025-12-01T...",
  "updated_at": "2025-12-01T..."
}
```

---

### `POST /api/scans/sessions/{session_id}/artifacts/`
**Upload RoomPlan JSON artifact**

**Request** (multipart/form-data):
```
file: <JSON blob>
kind: "roomplan_json"
```

**Response (201)**:
```json
{
  "upload_token": "abc123",
  "artifact": {
    "id": "uuid",
    "kind": "roomplan_json",
    "upload_token": "abc123",
    "status": "complete",
    "bytes": 12345,
    "content_type": "application/json",
    "file": "/media/scans/{session_id}/{upload_token}.json",
    "created_at": "2025-12-01T...",
    "updated_at": "2025-12-01T..."
  }
}
```

---

### `POST /api/scans/sessions/{session_id}/generate-recommendations/`
**Generate plant recommendations**

**Request**:
```json
{
  "user_id": "uuid",
  "window_orientation": "N" | "S" | "E" | "W" | null,
  "enrich_perenual": true
}
```

**Response (200)**:
```json
{
  "session_id": "uuid",
  "user_id": "uuid",
  "floorplan_summary": "Rooms: livingRoom, kitchen (2 total). Doors: 3. Windows: 2 (south-facing). Detected furnishings: sofa:1, chair:2, table:1.",
  "recommendations": {
    "livingRoom": {
      "plants": [
        {
          "name": "Pothos",
          "light_need": "low to medium indirect",
          "watering": "allow soil to dry between waterings",
          "placement": "corner shelf or hanging basket near south window",
          "reasoning": "Pothos is beginner-friendly, low-maintenance, and thrives in low to medium light. South-facing windows provide enough indirect light. Safe for pets.",
          "perenual": {
            "name": "Pothos",
            "perenual_id": 123,
            "common_name": "Golden Pothos",
            "scientific_name": "Epipremnum aureum",
            "watering_general_benchmark": "Average",
            "watering_interval_days": 7,
            "sunlight": "part shade",
            "maintenance_category": "low",
            "poison_human": false,
            "poison_pets": false,
            "default_image_url": "https://perenual.com/.../pothos.jpg",
            "care_notes": "...",
            "error": null
          }
        }
      ]
    }
  },
  "metadata": {
    "model": "gemini-2.5-flash",
    "timestamp": "2025-12-01T12:34:56.789Z",
    "window_orientation": "S",
    "perenual_enriched": true,
    "total_plants_recommended": 5
  }
}
```

---

## Environment Variables

### Backend (`backend/.env`)
```bash
# Django
DJANGO_SECRET_KEY=your_secret_key
DEBUG=True

# External APIs
GEMINI_API_KEY=your_gemini_key
PERENUAL_API_KEY=your_perenual_key
PLANTNET_API_KEY=your_plantnet_key
OPENWEATHER_API_KEY=your_openweather_key

# Supabase (backend access)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Frontend
FRONTEND_DEV_SERVER_ORIGIN=http://localhost:5173
```

### Mobile (`HeydayMobile/.env`)
```bash
# Supabase (client access)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Backend API
EXPO_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:8000
```

**Note**: Replace `YOUR_LOCAL_IP` with your computer's IP address for physical device testing.

---

## Success Metrics

- [ ] RoomPlan JSON successfully uploaded to Django backend (NO USDZ files)
- [ ] Django scans API uncommented and accessible
- [ ] User preferences added to Supabase `users` table
- [ ] Gemini generates per-room plant recommendations
- [ ] Perenual enriches 90%+ of plant names with care data + images
- [ ] Recommendations saved to Supabase `floorplans` and `plant_recommendations` tables
- [ ] Plants catalog populated with Perenual data (dedupe by perenual_id)
- [ ] Mobile app displays pending recommendations using existing hooks
- [ ] User can accept (adds to user_plants) / dismiss recommendations
- [ ] End-to-end flow completes in <20 seconds
- [ ] Error handling prevents user-facing crashes
- [ ] Perenual data cached in Django to reduce API calls

---

## Timeline Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 0 | Supabase schema updates | 0.5-1 hours |
| Phase 1 | Backend (Steps 1.1-1.5) | 4-6 hours |
| Phase 2 | Mobile (Steps 2.1-2.2) | 3-5 hours |
| Phase 3 | Testing | 2-3 hours |
| Phase 4 | Optimization | 1-2 hours |
| **Total** | | **10.5-17 hours** |

---

## Key Changes from Previous Version

1. **NO USDZ files** - Removed all references to USDZ upload/storage
2. **Supabase schema aligned** - Updated to match actual `supabase-schema-new.sql`
3. **User preferences** - Added Phase 0 to extend `users` table with preference fields
4. **Plants catalog upsert** - Properly dedupe by `perenual_id` when populating catalog
5. **recommended_location JSONB** - Store full Perenual data in recommendations for display
6. **Accept flow** - Accept action now adds to `user_plants` table with proper watering data
7. **Simplified mobile hooks** - Use existing `useFloorplans()` and `usePlantRecommendations()`

---

**End of Updated Plan (v2)**
