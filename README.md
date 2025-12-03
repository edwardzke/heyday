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

### AR Integration (RoomPlan) HOWTO (manual steps)
Follow these after prebuild to integrate the AR/RoomPlan component:

1) **Create the native build**
- `npx expo prebuild`
- In `ios/Podfile`, bump deployment target to 16.0:
  `platform :ios, podfile_properties['ios.deploymentTarget'] || '16.0'`
- Open workspace: `cd ios && xed HeydayMobile.xcworkspace`

2) **Add RoomPlan native files**
- In Xcode, right-click the topmost blue `HeydayMobile` project → New Group → `RoomPlan`.
- Add files from: `https://github.com/edwardzke/heyday/tree/integrateRoomPlanAPI/HeydayMobile/ios/RoomPlan`
- For each file, use the correct template (Swift for `.swift`, Objective-C for `.m`), same filenames, and check the HeydayMobile target. Paste code from the repo versions.

3) **Update the bridging header**
- Replace contents of `HeydayMobile/ios/HeydayMobile/HeydayMobile-Bridging-Header.h` with:
  `https://github.com/edwardzke/heyday/blob/integrateRoomPlanAPI/HeydayMobile/ios/HeydayMobile/HeydayMobile-Bridging-Header.h`

4) **Project settings**
- In Xcode (outermost blue project) → General: set Minimum Deployment to iOS 16.
- Frameworks/Libraries/Embedded: add `RoomPlan.framework` (Apple SDK), set to **Do Not Embed**.
- Signing & Capabilities: select your team and set a unique bundle ID.

5) **React side**
- Add `app/roomscan.tsx` from:
  `https://github.com/edwardzke/heyday/blob/integrateRoomPlanAPI/HeydayMobile/app/roomscan.tsx`
- Update navigation/button to route to `/roomscan` (replace `/camerapage`).

**Run on device**
- Avoid restrictive networks (e.g., eduroam); use hotspot/local Wi-Fi.
- Build in Xcode: `cd HeydayMobile/ios && xed HeydayMobile.xcworkspace`, then build to device.
- Once native build succeeds, from root: `npx expo run:ios --device`

### Recommendation Engine Notes
- `backend/recommendationEngine/floorPlanRecs.py` ingests RoomPlan JSON (sample at `backend/recommendationEngine/Room.json`), merges user context from Supabase, and calls Gemini (`gemini-2.5-pro`) for per-room plant placements.
- Pass an optional window orientation char (`N/S/E/W`) to `get_floor_plan_recommendations` (or `_summarize_roomplan`) so the summary tags windows with cardinal exposure to make light-aware prompts.
- Output target: concise JSON keyed by room with plant picks, placement, and care notes; add validation/persistence as you harden the flow.
