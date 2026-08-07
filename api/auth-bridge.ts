import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Bridge endpoint: after local passkey auth succeeds, call the shared
 * Atlas Island auth service to create a cross-realm session.
 *
 * Requires INTERNAL_BRIDGE_SECRET to call the shared auth /api/auth/bridge.
 */

const SHARED_AUTH_ORIGIN = process.env.SHARED_AUTH_ORIGIN || "https://auth.atlasisland.co";
const INTERNAL_BRIDGE_SECRET = process.env.INTERNAL_BRIDGE_SECRET || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!INTERNAL_BRIDGE_SECRET) {
    res.status(503).json({ error: "Bridge not configured" });
    return;
  }

  try {
    const body = req.body as { ces?: string; name?: string; deviceId?: string } | undefined;
    const ces = (body?.ces ?? "").toString().trim();
    const name = (body?.name ?? "").toString().trim();
    const deviceId = (body?.deviceId ?? "").toString().trim();

    if (!/^\d{9}$/.test(ces)) {
      res.status(400).json({ error: "A valid 9-digit CES is required" });
      return;
    }

    const bridgeRes = await fetch(`${SHARED_AUTH_ORIGIN}/api/auth/bridge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INTERNAL_BRIDGE_SECRET}`,
      },
      body: JSON.stringify({ ces, name, deviceId }),
    });

    if (!bridgeRes.ok) {
      const err = await bridgeRes.json().catch(() => ({}));
      throw new Error(err?.error || `Bridge failed (${bridgeRes.status})`);
    }

    const data = (await bridgeRes.json()) as {
      success: boolean;
      setCookieHeader?: string;
      cookieValue?: string;
      session?: { id: string; userId: string; cesProfileId: string; expiresAt: string };
    };

    if (!data.success || !data.setCookieHeader) {
      throw new Error("Bridge returned invalid session data");
    }

    // Relay the shared cookie back to the browser
    res.setHeader("Set-Cookie", data.setCookieHeader);

    res.status(200).json({
      bridged: true,
      sessionId: data.session?.id,
      userId: data.session?.userId,
      cesProfileId: data.session?.cesProfileId,
    });
  } catch (err: any) {
    console.error("auth-bridge error:", err);
    res.status(500).json({ error: err?.message ?? "Bridge call failed" });
  }
}
