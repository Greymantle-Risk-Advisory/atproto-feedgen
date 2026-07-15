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
  // Excludes check the raw text (so a domain like "reddit.com" still matches inside a URL);
  // includes check URL-stripped text (so short tickers like "/es" can't hide in a URL path).
  if (topic.excludeKeywords.some((kw) => keywordRegex(kw).test(text))) return false;
  const stripped = text.replace(URL_RE, " ");
  return topic.keywords.some((kw) => keywordRegex(kw).test(stripped));
}

export function matchingTopics(text: string, topics: TopicRule[]): string[] {
  return topics.filter((t) => matchesTopic(text, t)).map((t) => t.id);
}
