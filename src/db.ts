import type { TopicRule } from "./match.ts";

export interface TopicRow {
  id: string;
  rkey: string;
  display_name: string;
  description: string;
  keywords: string;
  exclude_keywords: string;
  created_at: number;
}

export async function listTopics(db: D1Database): Promise<TopicRow[]> {
  const { results } = await db.prepare("SELECT * FROM topics ORDER BY created_at ASC").all<TopicRow>();
  return results;
}

export function toTopicRules(rows: TopicRow[]): TopicRule[] {
  return rows.map((r) => ({
    id: r.id,
    keywords: JSON.parse(r.keywords),
    excludeKeywords: JSON.parse(r.exclude_keywords),
  }));
}

export async function insertTopic(
  db: D1Database,
  topic: { id: string; rkey: string; displayName: string; description: string; keywords: string[]; excludeKeywords: string[] },
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO topics (id, rkey, display_name, description, keywords, exclude_keywords, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      topic.id,
      topic.rkey,
      topic.displayName,
      topic.description,
      JSON.stringify(topic.keywords),
      JSON.stringify(topic.excludeKeywords),
      Date.now(),
    )
    .run();
}

export async function updateTopicKeywords(
  db: D1Database,
  id: string,
  keywords: string[],
  excludeKeywords: string[],
): Promise<void> {
  await db
    .prepare("UPDATE topics SET keywords = ?, exclude_keywords = ? WHERE id = ?")
    .bind(JSON.stringify(keywords), JSON.stringify(excludeKeywords), id)
    .run();
}

export async function deleteTopic(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM posts WHERE topic_id = ?").bind(id).run();
  await db.prepare("DELETE FROM topics WHERE id = ?").bind(id).run();
}

export async function insertMatch(db: D1Database, uri: string, topicId: string, indexedAt: number): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO posts (uri, topic_id, indexed_at) VALUES (?, ?, ?)")
    .bind(uri, topicId, indexedAt)
    .run();
}

export async function getSkeleton(
  db: D1Database,
  topicId: string,
  limit: number,
  before?: number,
): Promise<{ uri: string; indexed_at: number }[]> {
  const query = before
    ? db
        .prepare("SELECT uri, indexed_at FROM posts WHERE topic_id = ? AND indexed_at < ? ORDER BY indexed_at DESC LIMIT ?")
        .bind(topicId, before, limit)
    : db.prepare("SELECT uri, indexed_at FROM posts WHERE topic_id = ? ORDER BY indexed_at DESC LIMIT ?").bind(topicId, limit);
  const { results } = await query.all<{ uri: string; indexed_at: number }>();
  return results;
}

// ponytail: keep the newest N rows per topic, delete the rest. Runs off the DO alarm.
export async function pruneTopic(db: D1Database, topicId: string, keep: number): Promise<void> {
  await db
    .prepare(
      `DELETE FROM posts WHERE topic_id = ? AND uri NOT IN (
         SELECT uri FROM posts WHERE topic_id = ? ORDER BY indexed_at DESC LIMIT ?
       )`,
    )
    .bind(topicId, topicId, keep)
    .run();
}
