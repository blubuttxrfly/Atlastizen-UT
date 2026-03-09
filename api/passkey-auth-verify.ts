import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import { verifyAuthenticationResponse, type AuthenticatorDevice } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import {
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

    const body = req.body as { ces?: string; deviceId?: string; assertion?: AuthenticationResponseJSON };
    const ces = normalizeCes(body.ces);
    const deviceId = normalizeDeviceId(body.deviceId);
    const assertion = body.assertion;
    if (!assertion) {
      res.status(400).json({ error: "assertion response required" });
      return;
    }

    const challengeKey = `ces:challenge:${deviceId}:${ces}:auth`;
    const expectedChallenge = await kv.get<string>(challengeKey);
    if (!expectedChallenge) {
      res.status(400).json({ error: "Authentication challenge expired or missing" });
      return;
    }

    const credentialId = assertion.id;
    const stored = await kv.hgetall<Record<string, string | number>>(`ces:passkeys:${ces}:${credentialId}`);
    if (!stored) {
      res.status(404).json({ error: "Passkey not found for this CES" });
      return;
    }

    const authenticator: AuthenticatorDevice = {
      credentialID: Buffer.from(credentialId, "base64url"),
      credentialPublicKey: Buffer.from((stored.publicKey as string) ?? "", "base64"),
      counter: Number(stored.counter) || 0,
      transports:
        typeof stored.transports === "string" && stored.transports.length > 0
          ? (stored.transports.split(",") as AuthenticatorDevice["transports"])
          : undefined,
    };

    const { rpId, origin } = getRpConfig();

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      authenticator,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      res.status(400).json({ error: "Authentication verification failed" });
      return;
    }

    const { newCounter } = verification.authenticationInfo;
    await kv.hset(`ces:passkeys:${ces}:${credentialId}`, { ...stored, counter: newCounter });
    await kv.del(challengeKey);

    const sessionToken = randomToken();
    await kv.set(
      `ces:session:${sessionToken}`,
      { ces, deviceId, updatedAt: Date.now() },
      { ex: SESSION_TTL_SECONDS }
    );
    setSessionCookie(res, sessionToken, SESSION_TTL_SECONDS);

    res.status(200).json({ verified: true, ces });
  } catch (err: any) {
    console.error("passkey-auth-verify error:", err);
    res.status(400).json({ error: err?.message ?? "Authentication verify error" });
  }
}
