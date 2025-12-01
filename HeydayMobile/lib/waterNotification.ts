import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role to bypass RLS
);

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function runWateringReminderJob() {
  const nowIso = new Date().toISOString();

  // 1) Find plants that need watering
  const { data: plants, error } = await supabase
    .from("user_plants")
    .select("id, user_id, nickname, next_water_at, watering_frequency_days")
    .lte("next_water_at", nowIso);

  if (error) {
    console.error("Error fetching due plants:", error);
    return;
  }
  if (!plants || plants.length === 0) {
    console.log("No plants due for watering.");
    return;
  }

  // 2) Get the users + their device tokens
  const userIds = [...new Set(plants.map((p) => p.user_id))];

  const { data: users, error: userErr } = await supabase
    .from("users")
    .select("id, device_token")
    .in("id", userIds)
    .not("device_token", "is", null);

  if (userErr) {
    console.error("Error fetching users:", userErr);
    return;
  }

  const tokenByUser = new Map<string, string>();
  (users ?? []).forEach((u) => {
    tokenByUser.set(u.id, u.device_token);
  });

  // 3) Build push messages
  const messages: any[] = [];

  for (const plant of plants) {
    const token = tokenByUser.get(plant.user_id);
    if (!token) continue;

    const title = "Time to water your plant 💧";
    const body = plant.nickname
      ? `Your plant "${plant.nickname}" needs watering.`
      : "One of your plants needs watering.";

    messages.push({
      to: token,
      sound: "default",
      title,
      body,
      data: { plantId: plant.id },
    });

    // Optional: update next_water_at for the next reminder
    if (plant.watering_frequency_days) {
      const next = new Date();
      next.setDate(
        next.getDate() + Number(plant.watering_frequency_days || 0)
      );

      await supabase
        .from("user_plants")
        .update({ next_water_at: next.toISOString() })
        .eq("id", plant.id);
    }
  }

  if (messages.length === 0) return;

  // 4) Send to Expo Push API
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  const json = await res.json();
  console.log("Push result:", json);
}
