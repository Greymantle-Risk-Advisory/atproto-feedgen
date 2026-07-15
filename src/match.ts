export interface TopicRule {
  id: string;
  keywords: string[];
  excludeKeywords: string[];
}

// ponytail: plain substring match on lowercased text, no tokenizer/NLP — good enough
// for a niche keyword feed; revisit if false positives from substring matches (e.g.
// "IV" inside another word) become a real problem.
export function matchesTopic(text: string, topic: TopicRule): boolean {
  const lower = text.toLowerCase();
  if (topic.excludeKeywords.some((kw) => lower.includes(kw))) return false;
  return topic.keywords.some((kw) => lower.includes(kw));
}

export function matchingTopics(text: string, topics: TopicRule[]): string[] {
  return topics.filter((t) => matchesTopic(text, t)).map((t) => t.id);
}
