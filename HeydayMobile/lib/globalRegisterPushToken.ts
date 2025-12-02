// lib/registerPushToken.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export async function registerPushTokenForUser(userId: string) {
  // 1) Ask for permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return;
  }

  // 2) Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: "<your-expo-project-id>", // add from app.json/app.config
  });

  const token = tokenData.data;
  const platform = Platform.OS === "ios" ? "ios" : "android";

  // 3) Save to users table
  const { error } = await supabase
    .from("users")
    .update({
      device_token: token,
      device_platform: platform,
    })
    .eq("id", userId);

  if (error) {
    console.error("Error updating user with push token:", error);
  } else {
    console.log("Saved device token to user row");
  }
}
