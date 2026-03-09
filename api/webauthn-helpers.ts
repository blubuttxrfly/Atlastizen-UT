import type { VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

export function normalizeCes(raw: string | undefined | null): string {
  const code = (raw ?? "").toString().replace(/\D/g, "").slice(0, 9);
  if (code.length !== 9) {
    throw new Error("CES must be exactly 9 digits.");
  }
  return code;
}

export function normalizeDeviceId(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = (value ?? "").toString().trim();
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleaned) {
    throw new Error("deviceId is required");
  }
  return cleaned.slice(0, 64);
}

export function getRpConfig() {
  const envRpId =
    process.env.RP_ID ||
    (process.env.VERCEL_URL ? process.env.VERCEL_URL.replace(/^https?:\/\//, "") : "");
  const rpId = envRpId || (process.env.NODE_ENV === "development" ? "localhost" : "");

  const origin =
    process.env.RP_ORIGIN ||
    (rpId === "localhost" ? "http://localhost:5173" : rpId ? `https://${rpId}` : "");

  if (!rpId || !origin) {
    throw new Error("RP_ID and RP_ORIGIN are required (set to your production domain and https URL).");
  }
  return { rpId, origin, rpName: process.env.RP_NAME || "AUT Clock" };
}

export function setSessionCookie(res: VercelResponse, token: string, maxAgeSeconds: number) {
  const cookie = [
    `aut_session=${token}`,
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
export const CHALLENGE_TTL_SECONDS = 10 * 60; // 10 minutes
