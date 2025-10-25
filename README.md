## Heyday Monorepo Scaffold

Barebones structure to host the Heyday experience across Django, TypeScript + Tailwind, Swift, and Unity targets.

### Layout
- `backend/` — Django REST backend with a single `health/` endpoint to extend.
- `frontend/` — Vite + React + Tailwind shell ready to consume backend APIs or embed Unity WebGL builds.
- `ios/` — Swift Package placeholder for SwiftUI components or an iOS host app.
- `unity/` — Empty Unity project scaffold you can open in Unity Hub.

### Quickstart
1. **Backend**  
   ```bash
   cd backend
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```

2. **Frontend**  
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Vite proxies `/api/*` to the Django server on port `8000`.

3. **iOS (Swift)**  
   - Open `ios` in Xcode or run `swift build` to validate the package.
   - Add the package to an Xcode workspace once the native host is ready.

4. **Unity**  
   - Open the `unity` folder in Unity Hub, choose your template, and let Unity populate the project files.

### Next Steps
- Replace the example SwiftUI view with production UI.
- Flesh out authentication, persistence, and Unity embedding flows.
