import { DurableObject } from "cloudflare:workers";
import { listTopics, toTopicRules, insertMatch, pruneTopic } from "./db.ts";
import { matchingTopics } from "./match.ts";
import type { TopicRule } from "./match.ts";

const JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";
const ALARM_INTERVAL_MS = 30_000;
const TOPIC_REFRESH_MS = 60_000;
const PRUNE_KEEP = 2000;

interface JetstreamCommitEvent {
  did: string;
  time_us: number;
  kind: string;
  commit?: {
    operation: string;
    collection: string;
    rkey: string;
    record?: { text?: string };
  };
}

export class FirehoseListener extends DurableObject<Env> {
  private socket: WebSocket | null = null;
  private connecting = false;
  private topics: TopicRule[] = [];
  private topicsLoadedAt = 0;

  async alarm(): Promise<void> {
    this.maybeConnectJetstream();
    await this.pruneAll();
    await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
  }

  async ensureStarted(): Promise<void> {
    this.maybeConnectJetstream();
    const existing = await this.ctx.storage.getAlarm();
    if (existing === null) {
      await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    }
  }

  private maybeConnectJetstream(): void {
    if (this.connecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) return;
    this.connectJetstream();
  }

  private connectJetstream(): void {
    this.connecting = true;
    const socket = new WebSocket(JETSTREAM_URL);
    socket.addEventListener("open", () => {
      this.connecting = false;
    });
    socket.addEventListener("message", (event) => this.handleMessage(event));
    socket.addEventListener("close", () => {
      if (this.socket === socket) this.socket = null;
      this.connecting = false;
    });
    socket.addEventListener("error", () => {
      if (this.socket === socket) this.socket = null;
      this.connecting = false;
    });
    this.socket = socket;
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    await this.refreshTopicsIfStale();
    if (this.topics.length === 0) return;

    let parsed: JetstreamCommitEvent;
    try {
      parsed = JSON.parse(typeof event.data === "string" ? event.data : "");
    } catch {
      return;
    }
    const commit = parsed.commit;
    if (!commit || commit.operation !== "create" || commit.collection !== "app.bsky.feed.post") return;
    const text = commit.record?.text;
    if (!text || text.length > 3000) return;
    if (typeof parsed.did !== "string" || !parsed.did.startsWith("did:")) return;
    if (typeof commit.rkey !== "string" || !/^[a-zA-Z0-9._~-]{1,512}$/.test(commit.rkey)) return;

    const uri = `at://${parsed.did}/app.bsky.feed.post/${commit.rkey}`;
    const indexedAt = Math.floor(parsed.time_us / 1000);
    for (const topicId of matchingTopics(text, this.topics)) {
      await insertMatch(this.env.DB, uri, topicId, indexedAt);
    }
  }

  private async refreshTopicsIfStale(): Promise<void> {
    if (Date.now() - this.topicsLoadedAt < TOPIC_REFRESH_MS) return;
    this.topics = toTopicRules(await listTopics(this.env.DB));
    this.topicsLoadedAt = Date.now();
  }

  private async pruneAll(): Promise<void> {
    await this.refreshTopicsIfStale();
    for (const topic of this.topics) {
      await pruneTopic(this.env.DB, topic.id, PRUNE_KEEP);
    }
  }
}
