# AR room scanning system

This repo now ships a thin, clean pipeline for LiDAR/Depth-based room scanning with Unity (AR Foundation) on mobile, a Django ingest layer, and a web dashboard surface.

## Capture runtime (Unity)
- Packages: add AR Foundation + ARKit XR Plugin + ARCore XR Plugin; enable depth/mesh + plane detection.
- Scene graph: `ARSession`, `ARSessionOrigin` with `ARCameraManager`, `ARMeshManager`, `ARPlaneManager`, `AROcclusionManager`, UI `Canvas` for prompts/state.
- State machine: `Idle → Calibrate → Scanning → Processing`. Track coverage %, triangle budget, and capture keyframes every N seconds for QA.
- Export: merge `ARMeshManager` meshes into one, decimate to a target triangle budget, write GLB with vertex colors (confidence), attach JSON metadata (bounds, floor height, camera poses), optionally a short MP4 capture.
- Upload: create a scan session via `POST /api/scans/sessions/`, stream GLB (chunked) to `/api/scans/sessions/{id}/artifacts/` with `kind=raw_mesh`, then trigger `/api/scans/sessions/{id}/jobs/` to enqueue processing. Keep the UI responsive by doing mesh finalization on a worker thread.

### Controller sketch (Unity C#)
```csharp
// Attach to a persistent MonoBehaviour in your scanning scene.
public class RoomScanController : MonoBehaviour
{
    public ARMeshManager meshManager;
    public ARPlaneManager planeManager;
    public string apiBase = "https://your-api.example.com/api/scans/";

    private Guid sessionId;

    IEnumerator Start() {
        yield return CreateSession();
        // enter scanning state, guide the user, monitor coverage...
    }

    IEnumerator CreateSession() {
        var payload = "{\"platform\":\"ios\",\"device_type\":\"iPhone\",\"app_version\":\"1.0\"}";
        var request = new UnityWebRequest(apiBase + "sessions/", "POST");
        request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(payload));
        request.downloadHandler = new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");
        yield return request.SendWebRequest();
        var body = request.downloadHandler.text;
        var json = JsonUtility.FromJson<ScanSessionResponse>(body);
        sessionId = new Guid(json.id);
    }

    IEnumerator UploadMesh(byte[] glbBytes, string uploadToken = null) {
        var form = new List<IMultipartFormSection> {
            new MultipartFormFileSection("file", glbBytes, "scan.glb", "model/gltf-binary"),
            new MultipartFormDataSection("kind", "raw_mesh"),
        };
        if (!string.IsNullOrEmpty(uploadToken)) {
            form.Add(new MultipartFormDataSection("upload_token", uploadToken));
        }
        var request = UnityWebRequest.Post($"{apiBase}sessions/{sessionId}/artifacts/", form);
        yield return request.SendWebRequest();
        // handle 202 (chunk accepted) vs 201 (complete)
    }
}
```

## Backend endpoints (Django)
- `POST /api/scans/sessions/` — create a session. Returns session id and metadata.
- `GET /api/scans/sessions/` — list recent sessions (latest 25).
- `GET /api/scans/sessions/{id}/` — session detail with artifacts + processing jobs.
- `POST /api/scans/sessions/{id}/artifacts/` — upload raw/processed assets. Supports chunked uploads (`chunk_index`, `total_chunks`, optional `upload_token`). On final chunk it materializes the file and records metadata.
- `POST /api/scans/sessions/{id}/jobs/` — enqueue processing. Use `auto_complete=true` to stub success locally.

Artifacts live under `media/scans/{session_uuid}/{upload_token}.ext` and are typed via `kind` (`raw_mesh`, `processed_mesh`, `floorplan`, `camera_path`, `screen_capture`, `metadata`).

## Frontend surface (Vite)
- Dashboard now shows a “Room scans” card with live session status pulled from `/api/scans/sessions/`.
- Use the processed mesh artifact (`kind=processed_mesh`) as the default to visualize; fallback to raw mesh if processing is pending.

## Operational notes
- Triangle budget: target 200–300k tris per room for smooth mobile upload; decimate before upload to keep payloads under ~25 MB.
- Resilience: chunked uploads tolerate flaky mobile networks. Port the Unity uploader to resume at `chunk_index` with the same `upload_token`.
- Security: enforce auth headers once the auth story is wired; endpoints are intentionally open in this scaffold for local iteration. Media is stored under `backend/media`.
