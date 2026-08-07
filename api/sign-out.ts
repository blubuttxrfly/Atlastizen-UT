import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

const SHARED_AUTH_ORIGIN = process.env.SHARED_AUTH_ORIGIN || "https://auth.atlasisland.co";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Clear local session
    const cookies = req.headers.cookie || "";
    const sessionMatch = cookies.match(/(?:^|;\s*)aut_session=([^;]+)/);
    const sessionToken = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;
    if (sessionToken) {
      await kv.del(`ces:session:${sessionToken}`);
    }

    const clearLocalCookie = [
      `aut_session=`,
      `Path=/`,
      `HttpOnly`,
      `Secure`,
      `SameSite=Lax`,
      `Max-Age=0`,
      `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    ].join("; ");

    // Also clear shared Atlas Island cookie
    const clearSharedCookie = `atl_session_v2=; Domain=.atlasisland.co; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

    res.setHeader("Set-Cookie", [clearLocalCookie, clearSharedCookie]);
    res.status(200).json({ signedOut: true });
  } catch (err: any) {
    console.error("sign-out error:", err);
    res.status(500).json({ error: err?.message ?? "Sign-out failed" });
  }
}
