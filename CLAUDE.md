# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Heyday is a monorepo containing a plant/room scanning application with:
- **Backend**: Django REST API for room scanning sessions, artifact uploads, and floorplan generation
- **Frontend**: Vite + React + Tailwind web interface
- **Mobile**: Expo/React Native mobile app with AR camera capabilities

## Development Commands

### Backend (Django)

```bash
# Setup
cd backend
python3 -m venv venv
source venv/bin/activate  # or .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate

# Run development server
python manage.py runserver              # localhost:8000
python manage.py runserver 0.0.0.0:8000 # all interfaces

# Database migrations
python manage.py makemigrations
python manage.py migrate
python manage.py migrate --fake-initial  # if migrations exist

# Django shell
python manage.py shell
```

### Frontend (Vite + React)

```bash
cd frontend
npm install
npm run dev      # dev server on port 5173
npm run build    # production build
npm run preview  # preview production build
```

The Vite dev server proxies `/api/*` requests to Django on port 8000.

### Mobile (Expo)

```bash
cd HeydayMobile
npm install
npm start        # start Expo dev server
npm run android  # run on Android
npm run ios      # run on iOS
npm run web      # run in web browser
```

### Full Stack Launch

```bash
# Install all dependencies and run migrations
./install_dependencies.sh

# Launch backend + Expo mobile app together
./launchExpo.sh
```

## Architecture

### Backend Structure

**Django Apps:**
- `apps.core` - Basic health check endpoints and landing pages
- `apps.scans` - Room scanning session management, artifact uploads, and processing
- `uploads` - Generic file upload handling

**Key Models (apps/scans/models.py):**
- `RoomScanSession` - Container for a room scan with status tracking (created → uploading → processing → ready/failed)
- `ScanArtifact` - Uploaded files (meshes, floorplans, camera paths, screenshots, metadata)
- `ProcessingJob` - Async job tracking for mesh processing

**URL Structure:**
- `/api/` - Core API endpoints
- `/api/scans/` - Scanning endpoints (sessions, artifacts, processing)
- `/upload/` - Upload endpoints
- `/media/` - Uploaded files (development only)

**Environment Variables (.env in root):**
- `DJANGO_SECRET_KEY` - Django secret key
- `PLANTNET_API_KEY` - PlantNet API integration
- `OPENWEATHER_API_KEY` - Weather API integration
- `OPENWEATHER_DEFAULT_LOCATION` - Default location for weather
- `FRONTEND_DEV_SERVER_ORIGIN` - Frontend dev server URL (default: http://localhost:5173)

### Scanning Flow

1. Client creates a `RoomScanSession` via `POST /api/scans/sessions/`
2. Client uploads artifacts (meshes, camera data) via `POST /api/scans/sessions/{id}/upload/`
   - Supports chunked uploads with `chunk_index` and `total_chunks`
   - Each upload gets a unique `upload_token`
3. Client triggers processing via `POST /api/scans/sessions/{id}/process/`
   - Set `auto_complete=true` to auto-complete (stub mode)
   - Set `generate_floorplan=true` to generate SVG floorplan from mesh
4. Floorplan generation (apps/scans/floorplan.py):
   - Extracts floor-level vertices from 3D mesh using trimesh
   - Computes 2D convex hull
   - Renders as SVG polygon
5. Manual floorplan submission via `POST /api/scans/sessions/{id}/manual-floorplan/`
   - Accepts array of 2D points and optional scale factor
   - Useful when automated generation fails

### Frontend Structure

- `src/App.tsx` - Main React application
- `src/views/` - Page components
- Tailwind CSS for styling
- Vite configuration proxies `/api/*` to Django backend

### Mobile Structure (Expo Router)

- `app/_layout.tsx` - Root layout with navigation
- `app/index.tsx` - Landing/home screen
- `app/dashboard.tsx` - Main dashboard view
- `app/camerapage.tsx` - AR camera for scanning
- `app/addplant.tsx` - Plant identification and addition

**Key Dependencies:**
- `expo-camera` - Camera access for AR scanning
- `expo-gl` - OpenGL for 3D rendering
- `@react-navigation/*` - Navigation stack

## Development Notes

### Database

- SQLite3 in development (`backend/db.sqlite3`)
- Models use UUIDs as primary keys
- `TimestampedModel` base class adds `created_at` and `updated_at` fields

### File Uploads

- Artifacts stored in `backend/media/scans/{session_id}/{upload_token}.{ext}`
- Chunked upload support for large mesh files
- Status tracking: received → complete/corrupt

### API Permissions

- REST Framework configured with `IsAuthenticatedOrReadOnly` by default
- CORS enabled for all origins in development (`CORS_ALLOW_ALL_ORIGINS = True`)

### External Integrations

- PlantNet API for plant identification (requires API key)
- OpenWeather API for location-based weather data (requires API key)

### Testing

No test infrastructure currently configured. When adding tests:
- Backend: Use Django's test framework (`python manage.py test`)
- Frontend: Add test framework (Jest/Vitest) to package.json
- Mobile: Use Expo's testing tools

## Common Tasks

### Adding a New Django App

```bash
cd backend
python manage.py startapp app_name apps/app_name
# Add to INSTALLED_APPS in settings.py
# Add URLs to heyday_backend/urls.py
```

### Adding a New Scan Artifact Type

1. Add to `ScanArtifact.Kind` choices in `apps/scans/models.py`
2. Update serializers in `apps/scans/serializers.py` if needed
3. Update upload logic in `apps/scans/views.py` if special handling required

### Debugging Backend

- Check `backend/.runserver.log` when using launchExpo.sh
- Enable Django debug toolbar if needed
- Use `python manage.py shell` for interactive debugging
