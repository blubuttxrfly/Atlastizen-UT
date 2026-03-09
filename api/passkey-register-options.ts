import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import {
  generateRegistrationOptions,
  type GenerateRegistrationOptionsOpts,
} from "@simplewebauthn/server";
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
    const name = ((req.body as any)?.name ?? "").toString().trim() || `CES ${ces}`;
    const { rpId, origin, rpName } = getRpConfig();

  const existingIds = (await kv.smembers<string>(`ces:passkeys:index:${ces}`)) ?? [];
  const excludeCredentials = existingIds.map((id) => ({
    id: Buffer.from(id, "base64url"),
    type: "public-key" as const,
  }));
    // simplewebauthn v10 requires userID as binary, not string
    const userIdBuffer = Buffer.from(ces, "utf8");

  const optionsOpts: GenerateRegistrationOptionsOpts = {
    rpName,
    rpID: rpId,
    userID: userIdBuffer,
    userName: name,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials,
    };

    const options = await generateRegistrationOptions(optionsOpts);

    await kv.set(`ces:challenge:${deviceId}:${ces}:register`, options.challenge, {
      ex: CHALLENGE_TTL_SECONDS,
    });

    res.status(200).json({
      options,
      rpId,
      origin,
    });
  } catch (err: any) {
    console.error("passkey-register-options error:", err);
    res
      .status(err?.message?.includes("RP_ID") ? 400 : 500)
      .json({ error: err?.message ?? "Unable to create registration options" });
  }
}
