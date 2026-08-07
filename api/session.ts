import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

const SHARED_AUTH_ORIGIN = process.env.SHARED_AUTH_ORIGIN || "https://auth.atlasisland.co";

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
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const cookies = parseCookies(req.headers.cookie);

    // 1) Check local passkey session
    const localToken = cookies.aut_session;
    if (localToken) {
      const session = await kv.get<Record<string, string | number>>(`ces:session:${localToken}`);
      if (session && session.ces) {
        res.status(200).json({
          signedIn: true,
          ces: String(session.ces),
          deviceId: typeof session.deviceId === "string" ? session.deviceId : undefined,
          source: "local",
        });
        return;
      }
    }

    // 2) Check shared Atlas Island session (cross-property sign-in)
    const sharedToken = cookies.atl_session_v2;
    if (sharedToken && SHARED_AUTH_ORIGIN) {
      const sharedRes = await fetch(`${SHARED_AUTH_ORIGIN}/api/session`, {
        headers: {
          Cookie: `atl_session_v2=${sharedToken}`,
        },
      });
      if (sharedRes.ok) {
        const sharedData = (await sharedRes.json()) as {
          success?: boolean;
          user?: { cesProfileId?: string; email?: string };
          session?: { id: string };
        } | null;
        if (sharedData?.success && sharedData.user?.cesProfileId) {
          // Fetch enriched profile from central store
          let name = "";
          let photo = "";
          let stewardship = "";
          try {
            const profileRes = await fetch(`${SHARED_AUTH_ORIGIN}/api/profile/${sharedData.user.cesProfileId}`, {
              headers: { Cookie: `atl_session_v2=${sharedToken}` },
            });
            if (profileRes.ok) {
              const profileData = (await profileRes.json()) as Record<string, string> | null;
              name = profileData?.name || "";
              photo = profileData?.photoData || profileData?.photoUrl || "";
              stewardship = profileData?.stewardship || "";
            }
          } catch {
            // Non-blocking enrichment
          }
          res.status(200).json({
            signedIn: true,
            ces: sharedData.user.cesProfileId,
            name,
            photo,
            stewardship,
            source: "shared",
          });
          return;
        }
      }
    }

    res.status(200).json({ signedIn: false });
  } catch (err: any) {
    console.error("session error:", err);
    res.status(500).json({ error: err?.message ?? "Session check failed" });
  }
}
