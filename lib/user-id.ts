"use client";

import { v4 as uuidv4 } from "uuid";

const USER_ID_KEY = "quiz_platform_user_id";

export function getUserId(): string {
  if (typeof window === "undefined") return "server";
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

export function resetUserId(): string {
  const userId = uuidv4();
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}
