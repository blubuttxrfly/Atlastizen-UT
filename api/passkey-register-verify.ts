import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import {
  CHALLENGE_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  getRpConfig,
  normalizeCes,
  normalizeDeviceId,
  randomToken,
  setSessionCookie,
} from "./webauthn-helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = req.body as { ces?: string; deviceId?: string; attestation?: RegistrationResponseJSON; name?: string };
    const ces = normalizeCes(body.ces);
    const deviceId = normalizeDeviceId(body.deviceId);
    const attestation = body.attestation;
    if (!attestation) {
      res.status(400).json({ error: "attestation response required" });
      return;
    }

    const challengeKey = `ces:challenge:${deviceId}:${ces}:register`;
    const expectedChallenge = await kv.get<string>(challengeKey);
    if (!expectedChallenge) {
      res.status(400).json({ error: "Registration challenge expired or missing" });
      return;
    }

    const { rpId, origin } = getRpConfig();

    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "Registration verification failed" });
      return;
    }

    const {
      credentialID,
      credentialPublicKey,
      counter,
      credentialDeviceType,
      credentialBackedUp,
      credentialTransports,
    } = verification.registrationInfo;

    const id = credentialID.toString("base64url");
    const publicKey = credentialPublicKey.toString("base64");
    const transports = credentialTransports ?? [];

    await kv.hset(`ces:passkeys:${ces}:${id}`, {
      id,
      publicKey,
      counter,
      transports: transports.join(","),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp ? 1 : 0,
      createdAt: Date.now(),
    });
    await kv.sadd(`ces:passkeys:index:${ces}`, id);

    // Optional: keep a simple profile record
    if (typeof body.name === "string" && body.name.trim()) {
      await kv.hset(`ces:user:${ces}`, { name: body.name.trim(), updatedAt: Date.now() });
    }

    // consume challenge
    await kv.del(challengeKey);

    const sessionToken = randomToken();
    await kv.set(
      `ces:session:${sessionToken}`,
      { ces, deviceId, createdAt: Date.now() },
      { ex: SESSION_TTL_SECONDS }
    );
    setSessionCookie(res, sessionToken, SESSION_TTL_SECONDS);

    res.status(200).json({ verified: true, credentialId: id, ces });
  } catch (err: any) {
    console.error("passkey-register-verify error:", err);
    const message = err?.message ?? "Registration verify error";
    res.status(400).json({ error: message });
  }
}
