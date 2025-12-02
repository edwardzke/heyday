/**
 * Django backend API client
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface DjangoSession {
  id: string;
  label: string;
  status: string;
  created_at: string;
}

export interface DjangoArtifactUpload {
  upload_token: string;
  artifact?: {
    id: string;
    kind: string;
    status: string;
  };
}

export interface PlantRecommendation {
  name: string;
  light_need?: string;
  watering?: string;
  perenual_data?: {
    perenual_id: number | null;
    common_name: string | null;
    scientific_name: string | null;
    watering_general_benchmark: string | null;
    watering_interval_days: number | null;
    sunlight: string | null;
    maintenance_category: string | null;
    poison_human: boolean | null;
    poison_pets: boolean | null;
    default_image_url: string | null;
    care_notes: string | null;
    error: string | null;
  };
}

export interface RoomRecommendations {
  plants: PlantRecommendation[];
  placement?: string;
  reasoning?: string;
}

export interface DjangoRecommendationResponse {
  session_id: string;
  user_id: string;
  roomplan_summary: string;
  window_orientation: string | null;
  source_model: string;
  recommendations: Record<string, RoomRecommendations>;
}

/**
 * Create a new scan session
 */
export async function createScanSession(label?: string): Promise<DjangoSession> {
  const response = await fetch(`${BACKEND_URL}/api/scans/sessions/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      label: label || "Mobile AR Scan",
      device_type: "ios",
      platform: "mobile",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create scan session: ${response.status}`);
  }

  return response.json();
}

/**
 * Upload RoomPlan JSON artifact to a scan session
 */
export async function uploadRoomPlanJSON(
  sessionId: string,
  roomJsonString: string
): Promise<DjangoArtifactUpload> {
  const blob = new Blob([roomJsonString], { type: "application/json" });
  const formData = new FormData();
  formData.append("kind", "roomplan_json");
  formData.append("file", blob, "roomplan.json");

  const response = await fetch(
    `${BACKEND_URL}/api/scans/sessions/${sessionId}/artifacts/`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload RoomPlan JSON: ${response.status}`);
  }

  return response.json();
}

/**
 * Generate plant recommendations for a scan session
 */
export async function generateRecommendations(
  sessionId: string,
  userId: string,
  windowOrientation?: string
): Promise<DjangoRecommendationResponse> {
  const response = await fetch(
    `${BACKEND_URL}/api/scans/sessions/${sessionId}/generate-recommendations/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        window_orientation: windowOrientation,
        enrich_perenual: true,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to generate recommendations: ${response.status}`
    );
  }

  return response.json();
}
