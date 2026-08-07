import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import crypto from "node:crypto";

const HEARTLIGHT_BASE_URL =
  process.env.VITE_HEARTLIGHT_BASE_URL || "https://heartlight.atlasisland.co";

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { ces, passphrase } = req.body as { ces?: string; passphrase?: string };

    if (!ces || typeof ces !== "string" || ces.replace(/\D/g, "").length !== 9) {
      res.status(400).json({ error: "A valid 9-digit C.E.S. number is required." });
      return;
    }

    if (!passphrase || passphrase.length < 6) {
      res.status(400).json({ error: "Passphrase must be at least 6 characters." });
      return;
    }

    // Forward to Heartlight Collective auth endpoint
    const normalizedCes = ces.replace(/\D/g, "").slice(0, 9);
    const heartlightRes = await fetch(`${HEARTLIGHT_BASE_URL}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ces: normalizedCes, passphrase }),
    });

    if (!heartlightRes.ok) {
      const errorBody = await heartlightRes.json().catch(() => ({ error: "Unknown error" }));
      res.status(heartlightRes.status).json({
        error: errorBody.error || "C.E.S. not found or passphrase does not match.",
      });
      return;
    }

    const heartlightData = (await heartlightRes.json()) as {
      profile?: {
        ces_number?: string;
        cesNumber?: string;
        name?: string;
        photo_url?: string;
        photo?: string;
        stewardship?: string;
      };
    };

    if (!heartlightData?.profile) {
      res.status(401).json({ error: "C.E.S. not found or passphrase does not match." });
      return;
    }

    const profile = heartlightData.profile;
    const cesNum = profile.cesNumber || profile.ces_number || normalizedCes;

    // Create a local session token
    const sessionToken = crypto.randomBytes(32).toString("hex");
    await kv.set(`ces:session:${sessionToken}`, {
      ces: cesNum,
      name: profile.name || "",
      source: "ces-passphrase",
      createdAt: Date.now(),
    });
    // Expire session after 30 days
    await kv.expire(`ces:session:${sessionToken}`, 30 * 24 * 60 * 60);

    // Also write profile to local KV for fast lookup
    const existingProfile = await kv.get<Record<string, string>>(`ces:user:${cesNum}`);
    const updatedProfile: Record<string, string | number | undefined> = {
      ...(typeof existingProfile === "object" && existingProfile !== null ? existingProfile : {}),
      name: profile.name || (typeof existingProfile === "object" ? existingProfile?.name || "" : ""),
      code: cesNum,
      photoUrl: profile.photo || profile.photo_url || undefined,
      stewardship: profile.stewardship || undefined,
      updatedAt: Date.now(),
    };
    await kv.set(`ces:user:${cesNum}`, updatedProfile);

    // ── Sync to central C.E.S. profile store (shared auth) ──
    const sharedAuthOrigin = process.env.SHARED_AUTH_ORIGIN || "https://auth.atlasisland.co";
    const bridgeSecret = process.env.INTERNAL_BRIDGE_SECRET || "";
    if (sharedAuthOrigin && bridgeSecret) {
      try {
        await fetch(`${sharedAuthOrigin}/api/profile/${cesNum}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profile.name || "",
            photoData: profile.photo || profile.photo_url || undefined,
            stewardship: profile.stewardship || "none",
          }),
        });
        console.log("[auth-signin] Synced profile to central store:", cesNum);
      } catch (err) {
        console.warn("[auth-signin] Central store sync failed (non-blocking):", err);
      }
    }

    // Set local session cookie
    const isSecure = process.env.NODE_ENV !== "development";
    res.setHeader(
      "Set-Cookie",
      `aut_session=${sessionToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}${isSecure ? "; Secure" : ""}`
    );

    res.status(200).json({
      success: true,
      ces: cesNum,
      name: profile.name || "",
      photo: profile.photo || profile.photo_url || "",
      stewardship: profile.stewardship || "",
    });
  } catch (err: any) {
    console.error("[auth-signin] error:", err);
    res.status(500).json({ error: err?.message ?? "Sign-in failed" });
  }
}
