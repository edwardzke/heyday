// lib/plantNotifications.ts
import * as Notifications from "expo-notifications";

import {supabase} from "./supabase";

/**
 * Ask user for notification permissions if needed.
 * iOS will show the system popup the first time this runs.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Notification permission not granted");
    return false;
  }

  return true;
}

/**
 * Convert a DATE string from Supabase ("YYYY-MM-DD")
 * into a JS Date at 9:00 AM local time.
 */
export function dateStringToReminderDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;

  const [yearStr, monthStr, dayStr] = parts;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;

  // Month is 0-based in JS Date: 0 = Jan, 11 = Dec
  const date = new Date(year, month - 1, day, 9, 0, 0);

  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Build a DATE string "YYYY-MM-DD" from a JS Date (local calendar date).
 */
export function toDateStringLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Add N days to a JS Date and return "YYYY-MM-DD".
 */
export function computeNextWaterDateString(
  fromDate: Date,
  days: number
): string {
  const d = new Date(fromDate);
  // use local date only; time-of-day doesn't matter for the DATE column
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toDateStringLocal(d);
}

/**
 * Shape of the plant object needed for scheduling.
 * This is for the *local notification* part, not the full DB row.
 */
export type PlantForReminder = {
  id: string;                // user_plants.id
  nickname: string | null;
  next_water_at: string | null; // "YYYY-MM-DD" from Supabase
  notification_id?: string | null; // optional: stored on user_plants.notification_id
};

/**
 * Schedule a single local notification for a plant,
 * based on its `next_water_at` DATE.
 *
 * Returns the notification ID (string) if scheduled,
 * or null if it didn't schedule (no date / past date / no permission).
 */
export async function scheduleLocalWaterReminderForPlant(
  plant: PlantForReminder
): Promise<string | null> {
  // Make sure we have permission (this will trigger iOS popup once)
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return null;

  if (!plant.next_water_at) {
    console.log("No next_water_at set for plant, not scheduling notification.");
    return null;
  }

  const triggerDate = dateStringToReminderDate(plant.next_water_at);
  if (!triggerDate) {
    console.log("Invalid next_water_at date, not scheduling notification.");
    return null;
  }

  const now = new Date();
  if (triggerDate <= now) {
    console.log("next_water_at is in the past, not scheduling notification.");
    return null;
  }

  const title = "Time to water your plant 💧";
  const body = plant.nickname
    ? `Your plant "${plant.nickname}" needs watering.`
    : "One of your plants needs watering.";

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { userPlantId: plant.id },
    },
    trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,    
      },
  });

  console.log("Scheduled local notification for user_plants row:", plant.id, notificationId);
  return notificationId;
}

/**
 * Cancel a previously scheduled local notification,
 * if you have its ID (optional helper).
 */
export async function cancelWaterReminder(notificationId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log("Cancelled local notification:", notificationId);
  } catch (e) {
    console.warn("Failed to cancel notification:", e);
  }
}

/**
 * When a user waters a plant:
 *  - figure out the effective watering interval (user override or plant default),
 *  - cancel existing notification (if any),
 *  - update last_watered_at + next_water_at in user_plants,
 *  - schedule a new notification at the new next_water_at,
 *  - store the new notification_id back in user_plants.
 *
 * This assumes:
 *  - user_plants has a `notification_id text` column
 *  - you have a foreign key user_plants.plant_id -> plants.id
 */
export async function waterPlantAndReschedule(userPlantId: string) {
  // 1) Fetch the user_plants row + the related plant's watering_interval_days
  const { data, error } = await supabase
    .from("user_plants")
    .select(
      `
      id,
      nickname,
      watering_frequency_days,
      last_watered_at,
      next_water_at,
      notification_id,
      plant:plant_id (
        watering_interval_days
      )
    `
    )
    .eq("id", userPlantId)
    .single();

  if (error || !data) {
    console.error("Failed to fetch user_plants row:", error);
    return;
  }

  const userPlant = data as any;
  // 2) Determine effective watering interval
  const effectiveDays =
    userPlant.watering_frequency_days ??
    userPlant.plant?.watering_interval_days ??
    7; // sensible default if nothing set

  // 3) Cancel existing notification if present
  if (userPlant.notification_id) {
    await cancelWaterReminder(userPlant.notification_id);
  }

  // 4) Today is "last_watered_at"
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastWateredAt = toDateStringLocal(today);

  // 5) Compute new next_water_at
  const nextWaterAt = computeNextWaterDateString(today, effectiveDays);

  // 6) Update the DB with last_watered_at + next_water_at
  const { data: updatedRow, error: updateError } = await supabase
    .from("user_plants")
    .update({
      last_watered_at: lastWateredAt,
      next_water_at: nextWaterAt,
    })
    .eq("id", userPlantId)
    .select("id, nickname, next_water_at")
    .single();

  if (updateError || !updatedRow) {
    console.error("Failed to update user_plants row:", updateError);
    return;
  }

  // 7) Schedule a new notification for the updated row
  const notificationId = await scheduleLocalWaterReminderForPlant({
    id: updatedRow.id,
    nickname: updatedRow.nickname,
    next_water_at: updatedRow.next_water_at,
  });

  // 8) Save the new notification_id on the user_plants row
  if (notificationId) {
    const { error: notifErr } = await supabase
      .from("user_plants")
      .update({ notification_id: notificationId })
      .eq("id", userPlantId);

    if (notifErr) {
      console.error("Failed to persist notification_id:", notifErr);
    }
  }
}

/**
 * (Optional) Helper to (re)schedule reminders for all of a user's plants,
 * e.g. on app launch.
 *
 * This expects `next_water_at` to already be set in the DB.
 */
export async function rescheduleAllWaterRemindersForUser(userId: string) {
  const { data, error } = await supabase
    .from("user_plants")
    .select("id, nickname, next_water_at, notification_id")
    .eq("user_id", userId);

  if (error || !data) {
    console.error("Failed to fetch user plants for rescheduling:", error);
    return;
  }

  // You *could* cancel all existing ones first if you want a clean slate.
  for (const row of data) {
    const plant: PlantForReminder = {
      id: row.id,
      nickname: row.nickname,
      next_water_at: row.next_water_at,
      notification_id: row.notification_id,
    };

    // For simplicity, just schedule if next_water_at is in the future.
    const triggerDate = dateStringToReminderDate(plant.next_water_at);
    if (!triggerDate) continue;
    if (triggerDate <= new Date()) continue;

    const newId = await scheduleLocalWaterReminderForPlant(plant);

    if (newId) {
      await supabase
        .from("user_plants")
        .update({ notification_id: newId })
        .eq("id", plant.id);
    }
  }
}

/**
 * Schedule a repeating local notification for a plant,
 * based on its `watering_frequency_days`.
 */
export async function scheduleRepeatingWaterReminderForPlant(
    plantId: string,
    nickname: string | null,
    intervalDays: number
  ): Promise<string | null> {
    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) return null;
  
    const seconds = intervalDays * 24 * 60 * 60;
  
    const title = "Time to water your plant 💧";
    const body = nickname
      ? `Your plant "${nickname}" needs watering.`
      : "One of your plants needs watering.";
  
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { userPlantId: plantId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
      },
    });
  
    console.log("Scheduled repeating notification:", plantId, notificationId);
    return notificationId;
  }
  