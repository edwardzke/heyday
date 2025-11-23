## Heyday Monorepo

Production scaffold hosting the Heyday experience across Django, React, Expo, and supporting services.

### Layout
- `backend/` — Django REST backend plus `recommendationEngine/` with Gemini + Supabase plant recs (`floorPlanRecs.py`, `Room.json` sample).
- `frontend/` — Vite + React + Tailwind web shell.
- `HeydayMobile/` — Expo/React Native app (see `launchExpo.sh`).
- `docs/` — Project docs and design notes.
- `render.yaml` — Render deployment manifest.

### Build & Run
- **Backend**
  ```bash
  cd backend
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt  # includes supabase and python-dotenv
  python manage.py migrate
  python manage.py runserver  # http://localhost:8000
  ```
  Env vars for rec engine: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`.

- **Frontend**
  ```bash
  cd frontend
  npm install
  npm run dev  # Vite dev server with /api proxy to :8000
  ```

- **Mobile (Expo)**
  ```bash
  ./launchExpo.sh
  ```

### Recommendation Engine Notes
- `backend/recommendationEngine/floorPlanRecs.py` ingests RoomPlan JSON (sample at `backend/recommendationEngine/Room.json`), merges user context from Supabase, and calls Gemini (`gemini-2.5-pro`) for per-room plant placements.
- Pass an optional window orientation char (`N/S/E/W`) to `get_floor_plan_recommendations` (or `_summarize_roomplan`) so the summary tags windows with cardinal exposure to make light-aware prompts.
- Output target: concise JSON keyed by room with plant picks, placement, and care notes; add validation/persistence as you harden the flow.
