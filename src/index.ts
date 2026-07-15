import { listTopics, insertTopic, updateTopicKeywords, deleteTopic, getSkeleton } from "./db.ts";
export { FirehoseListener } from "./durable-object.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function requireAdmin(req: Request, env: Env): Response | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: "Unauthorized" }, 401);
  return null;
}

function feedUri(env: Env, rkey: string): string {
  return `at://${env.FEEDGEN_PUBLISHER_DID}/app.bsky.feed.generator/${rkey}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Kick the Durable Object's firehose listener alive on any request; it no-ops if already running.
    const stub = env.FIREHOSE_LISTENER.get(env.FIREHOSE_LISTENER.idFromName("singleton"));
    await stub.ensureStarted();

    if (url.pathname === "/.well-known/did.json") {
      return json({
        "@context": ["https://www.w3.org/ns/did/v1"],
        id: `did:web:${env.FEEDGEN_HOSTNAME}`,
        service: [
          {
            id: "#bsky_fg",
            type: "BskyFeedGenerator",
            serviceEndpoint: `https://${env.FEEDGEN_HOSTNAME}`,
          },
        ],
      });
    }

    if (url.pathname === "/xrpc/app.bsky.feed.describeFeedGenerator") {
      const topics = await listTopics(env.DB);
      return json({
        did: `did:web:${env.FEEDGEN_HOSTNAME}`,
        feeds: topics.map((t) => ({ uri: feedUri(env, t.rkey) })),
      });
    }

    if (url.pathname === "/xrpc/app.bsky.feed.getFeedSkeleton") {
      const feed = url.searchParams.get("feed");
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50") || 50, 1), 100);
      const cursor = url.searchParams.get("cursor");
      const before = cursor ? Number(cursor) : undefined;

      const topics = await listTopics(env.DB);
      const topic = topics.find((t) => feedUri(env, t.rkey) === feed);
      if (!topic) return json({ error: "InvalidRequest", message: "Unknown feed" }, 400);

      const rows = await getSkeleton(env.DB, topic.id, limit, before);
      const nextCursor = rows.length > 0 ? String(rows[rows.length - 1].indexed_at) : undefined;
      return json({ feed: rows.map((r) => ({ post: r.uri })), cursor: nextCursor });
    }

    if (url.pathname === "/admin/topics" && request.method === "GET") {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      return json(await listTopics(env.DB));
    }

    if (url.pathname === "/admin/topics" && request.method === "POST") {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      let body: {
        rkey: string;
        displayName: string;
        description?: string;
        keywords: string[];
        excludeKeywords?: string[];
      };
      try {
        body = await request.json();
      } catch {
        return json({ error: "InvalidRequest", message: "malformed JSON body" }, 400);
      }
      if (
        !body.rkey ||
        !body.displayName ||
        !Array.isArray(body.keywords) ||
        body.keywords.length === 0 ||
        !body.keywords.every((k) => typeof k === "string" && k.length > 0) ||
        (body.excludeKeywords !== undefined &&
          !body.excludeKeywords.every((k) => typeof k === "string" && k.length > 0))
      ) {
        return json({ error: "InvalidRequest", message: "rkey, displayName, keywords[] required" }, 400);
      }
      await insertTopic(env.DB, {
        id: crypto.randomUUID(),
        rkey: body.rkey,
        displayName: body.displayName,
        description: body.description ?? "",
        keywords: body.keywords.map((k) => k.toLowerCase()),
        excludeKeywords: (body.excludeKeywords ?? []).map((k) => k.toLowerCase()),
      });
      return json({ ok: true }, 201);
    }

    if (url.pathname.startsWith("/admin/topics/") && request.method === "PATCH") {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      const id = url.pathname.split("/").pop()!;
      let body: { keywords: string[]; excludeKeywords?: string[] };
      try {
        body = await request.json();
      } catch {
        return json({ error: "InvalidRequest", message: "malformed JSON body" }, 400);
      }
      if (
        !id ||
        !Array.isArray(body.keywords) ||
        body.keywords.length === 0 ||
        !body.keywords.every((k) => typeof k === "string" && k.length > 0) ||
        (body.excludeKeywords !== undefined &&
          !body.excludeKeywords.every((k) => typeof k === "string" && k.length > 0))
      ) {
        return json({ error: "InvalidRequest", message: "keywords[] required" }, 400);
      }
      const updated = await updateTopicKeywords(
        env.DB,
        id,
        body.keywords.map((k) => k.toLowerCase()),
        (body.excludeKeywords ?? []).map((k) => k.toLowerCase()),
      );
      if (!updated) return json({ error: "NotFound" }, 404);
      return json({ ok: true });
    }

    if (url.pathname.startsWith("/admin/topics/") && request.method === "DELETE") {
      const denied = requireAdmin(request, env);
      if (denied) return denied;
      const id = url.pathname.split("/").pop()!;
      if (!id) return json({ error: "NotFound" }, 404);
      const deleted = await deleteTopic(env.DB, id);
      if (!deleted) return json({ error: "NotFound" }, 404);
      return json({ ok: true });
    }

    return json({ error: "NotFound" }, 404);
  },
} satisfies ExportedHandler<Env>;
