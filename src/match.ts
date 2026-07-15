export interface TopicRule {
  id: string;
  keywords: string[];
  excludeKeywords: string[];
}

// Real-world false positive: keyword "/es" (E-mini S&P futures ticker) matched every
// URL with a Spanish-locale path segment ("ftwr.cloud/es/news/..."). Strip URLs before
// matching, and require word boundaries so short tokens can't hide inside other text.
const URL_RE = /https?:\/\/\S+/gi;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordRegex(keyword: string): RegExp {
  return new RegExp(`(?<!\\w)${escapeRegex(keyword)}(?!\\w)`, "i");
}

export function matchesTopic(text: string, topic: TopicRule): boolean {
  const stripped = text.replace(URL_RE, " ");
  if (topic.excludeKeywords.some((kw) => keywordRegex(kw).test(stripped))) return false;
  return topic.keywords.some((kw) => keywordRegex(kw).test(stripped));
}

export function matchingTopics(text: string, topics: TopicRule[]): string[] {
  return topics.filter((t) => matchesTopic(text, t)).map((t) => t.id);
}
