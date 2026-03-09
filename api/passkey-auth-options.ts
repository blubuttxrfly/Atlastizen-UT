import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { CHALLENGE_TTL_SECONDS, getRpConfig, normalizeCes, normalizeDeviceId } from "./webauthn-helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const ces = normalizeCes((req.body as any)?.ces);
    const deviceId = normalizeDeviceId((req.body as any)?.deviceId);
    const { rpId } = getRpConfig();

    const ids = (await kv.smembers<string>(`ces:passkeys:index:${ces}`)) ?? [];
    if (ids.length === 0) {
      res.status(404).json({ error: "No passkeys registered for this CES" });
      return;
    }

    const allowCredentials = (
      await Promise.all(
        ids.map(async (id) => {
          const data = await kv.hgetall<Record<string, string | number>>(`ces:passkeys:${ces}:${id}`);
          if (!data) return null;
          const transports =
            typeof data.transports === "string" && data.transports.length > 0 ? data.transports.split(",") : undefined;
          return {
            id: Buffer.from(id, "base64url"),
            type: "public-key" as const,
            transports,
          };
        })
      )
    ).filter(Boolean);

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: "preferred",
      allowCredentials,
    });

    await kv.set(`ces:challenge:${deviceId}:${ces}:auth`, options.challenge, { ex: CHALLENGE_TTL_SECONDS });

    res.status(200).json({ options, rpId });
  } catch (err: any) {
    console.error("passkey-auth-options error:", err);
    res
      .status(err?.message?.includes("RP_ID") ? 400 : 500)
      .json({ error: err?.message ?? "Unable to create authentication options" });
  }
}
