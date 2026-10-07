import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import crypto from "node:crypto";

type PostPayload = {
  name?: string;
  code?: string;
  message?: string;
  photoData?: string;
  photoName?: string;
  imageData?: string;
  imageName?: string;
};

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
}

/** Verify that the requester has a valid session cookie.
 *  Returns the CES number if authenticated, null otherwise. */
async function verifySession(req: VercelRequest): Promise<string | null> {
  const cookies = parseCookies(req.headers.cookie);
  const localToken = cookies.aut_session;
  if (!localToken) return null;
  try {
    const session = await kv.get<Record<string, string | number>>(`ces:session:${localToken}`);
    if (session && session.ces) {
      return String(session.ces);
    }
  } catch {
    // KV error, treat as unauthenticated
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const adminToken = process.env.ADMIN_TOKEN;

  try {
    if (req.method === "GET") {
      const ids = (await kv.zrange<string[]>("community:posts", 0, 119, { rev: true })) ?? [];
      const posts = await Promise.all(
        ids.map(async (id) => {
          const data = await kv.hgetall<Record<string, string | number>>(`community:post:${id}`);
          return data
            ? {
                id,
                name: (data.name as string) ?? "Anonymous",
                code: (data.code as string) ?? "",
                message: (data.message as string) ?? "",
                photoData: typeof data.photoData === "string" ? data.photoData : "",
                photoName: typeof data.photoName === "string" ? data.photoName : "",
                imageData: typeof data.imageData === "string" ? data.imageData : "",
                imageName: typeof data.imageName === "string" ? data.imageName : "",
                createdAt: Number(data.createdAt) || Date.now(),
              }
            : null;
        })
      );
      res.status(200).json(posts.filter(Boolean));
      return;
    }

    if (req.method === "POST") {
      // ── Server-side session verification ──
      const sessionCes = await verifySession(req);
      if (!sessionCes) {
        res.status(401).json({ error: "Sign in required to post." });
        return;
      }

      const body = req.body as PostPayload;
      const message = (body?.message ?? "").toString().trim();
      if (!message) {
        res.status(400).json({ error: "Message required" });
        return;
      }
      const id = crypto.randomUUID();
      const createdAt = Date.now();
      const name = (body?.name ?? "Anonymous").toString().trim() || "Anonymous";
      // Use the CES from the session, not the client, to prevent impersonation
      const code = sessionCes;
      const photoData = typeof body?.photoData === "string" ? body.photoData : "";
      const photoName = typeof body?.photoName === "string" ? body.photoName : "";
      const imageData = typeof body?.imageData === "string" ? body.imageData : "";
      const imageName = typeof body?.imageName === "string" ? body.imageName : "";

      await kv.hset(`community:post:${id}`, { id, name, code, message, createdAt, photoData, photoName, imageData, imageName });
      await kv.zadd("community:posts", { score: createdAt, member: id });

      res.status(201).json({ id, name, code, message, createdAt, photoData, photoName, imageData, imageName });
      return;
    }

    if (req.method === "DELETE") {
      const id = req.query.id;
      const headerToken = req.headers["x-admin-token"];
      const provided =
        Array.isArray(headerToken) && headerToken.length > 0 ? headerToken[0] : typeof headerToken === "string" ? headerToken : null;
      if (!adminToken || provided !== adminToken) {
        res.status(403).json({ error: "Admin only" });
        return;
      }
      if (typeof id !== "string") {
        res.status(400).json({ error: "id required" });
        return;
      }
      await kv.del(`community:post:${id}`);
      await kv.zrem("community:posts", id);
      res.status(204).end();
      return;
    }

    res.setHeader("Allow", "GET,POST,DELETE");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Server error" });
  }
}