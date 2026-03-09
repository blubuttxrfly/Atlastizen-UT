import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import crypto from "node:crypto";

type CesProfilePayload = {
  name?: string;
  code?: string;
  photoData?: string;
  photoName?: string;
  theme?: string;
  uiTheme?: string;
};

type StoredProfile = {
  name?: string;
  code?: string;
  photoData?: string;
  photoName?: string;
  theme?: string;
  uiTheme?: string;
  adminCes?: string;
  updatedAt?: number;
  updatedBy?: string;
};

const SECRET = process.env.ADMIN_CES_SECRET;

function normalizeCode(raw: string): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 9);
}

function normalizeDeviceId(raw: unknown): string | null {
  if (typeof raw === "undefined" || raw === null) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = value.toString().trim();
  if (!id) return null;
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned ? cleaned.slice(0, 64) : null;
}

function resolveKey(): Buffer {
  if (!SECRET) {
    throw new Error("ADMIN_CES_SECRET missing");
  }
  return crypto.createHash("sha256").update(SECRET).digest();
}

function encryptCode(code: string): string {
  const key = resolveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

function decryptCode(payload: string): string {
  const key = resolveKey();
  const data = Buffer.from(payload, "base64url");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SECRET) {
    res.status(500).json({ error: "ADMIN_CES_SECRET not configured" });
    return;
  }

  try {
    const isGet = req.method === "GET";
    const deviceId = isGet ? normalizeDeviceId(req.query.deviceId) : normalizeDeviceId((req.body as any)?.deviceId);
    const cesQuery = isGet ? normalizeCode((req.query.ces as string) ?? "") : normalizeCode((req.body as any)?.ces ?? "");
    const keyId = cesQuery || deviceId;
    if (!keyId) {
      res.status(400).json({ error: "deviceId or ces is required" });
      return;
    }
    const CES_PROFILE_KEY = `ces:profile:${keyId}`;

    if (req.method === "GET") {
      const stored = (await kv.hgetall<StoredProfile>(CES_PROFILE_KEY)) ?? null;
      if (!stored) {
        res.status(200).json(null);
        return;
      }
      let code = "";
      const encryptedCode = stored.code || stored.adminCes || "";
      if (encryptedCode) {
        try {
          code = decryptCode(encryptedCode);
        } catch {
          code = "";
        }
      }
      res.status(200).json({
        name: stored.name ?? "",
        code,
        photoData: stored.photoData ?? "",
        photoName: stored.photoName ?? "",
        adminCes: encryptedCode || undefined,
        theme: stored.theme ?? stored.uiTheme ?? "",
        uiTheme: stored.uiTheme ?? stored.theme ?? "",
        updatedAt:
          typeof stored.updatedAt === "number"
            ? stored.updatedAt
            : Number(stored.updatedAt ?? "") || null,
      });
      return;
    }

    if (req.method === "POST") {
      const body = req.body as CesProfilePayload;
      const name = (body?.name ?? "").toString().trim();
      const normalizedCode = normalizeCode((body?.code ?? "").toString());
      if (normalizedCode.length !== 9) {
        res.status(400).json({ error: "Exactly 9 digits are required for the Core Energetic Signature." });
        return;
      }
      const encryptedCode = encryptCode(normalizedCode);
      const photoData = typeof body?.photoData === "string" ? body.photoData : "";
      const photoName = typeof body?.photoName === "string" ? body.photoName : "";
      const theme = typeof body?.theme === "string" ? body.theme : typeof body?.uiTheme === "string" ? body.uiTheme : "";
      const updatedAt = Date.now();

      const payload = {
        name,
        code: encryptedCode,
        adminCes: encryptedCode,
        photoData,
        photoName,
        theme,
        uiTheme: theme,
        updatedAt,
        updatedBy: deviceId,
      };

      await kv.hset(CES_PROFILE_KEY, payload);

      // also store by normalized CES code so other devices can load it
      const codeKey = `ces:profile:${normalizedCode}`;
      await kv.hset(codeKey, payload);

      res.status(200).json({
        name,
        code: normalizedCode,
        photoData,
        photoName,
        adminCes: encryptedCode,
        theme,
        uiTheme: theme,
        updatedAt,
      });
      return;
    }

    res.setHeader("Allow", "GET,POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Server error" });
  }
}
