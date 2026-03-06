import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatDateShort(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getScoreLabel(score: number): {
  label: string;
  color: string;
} {
  if (score >= 90) return { label: "優秀", color: "text-green-500" };
  if (score >= 75) return { label: "良好", color: "text-primary" };
  if (score >= 60) return { label: "及格", color: "text-yellow-500" };
  return { label: "不及格", color: "text-destructive" };
}

export function generateShareUrl(type: "test" | "result", token: string): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin;
  return type === "test" ? `${base}/t/${token}` : `${base}/r/${token}`;
}
