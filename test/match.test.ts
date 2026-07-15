import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesTopic, matchingTopics } from "../src/match.ts";

const optionsTopic = {
  id: "options-futures",
  keywords: ["options", "futures", "theta", "/es"],
  excludeKeywords: ["nfl futures"],
};

test("matches on keyword, case-insensitive", () => {
  assert.equal(matchesTopic("Selling THETA on my SPY options today", optionsTopic), true);
});

test("no match when no keyword present", () => {
  assert.equal(matchesTopic("just posted a photo of my cat", optionsTopic), false);
});

test("exclude list overrides keyword match", () => {
  assert.equal(matchesTopic("my NFL futures picks for week 3", optionsTopic), false);
});

test("matchingTopics returns ids of all matching topics", () => {
  const cats = { id: "cats", keywords: ["cat"], excludeKeywords: [] };
  const ids = matchingTopics("my cat loves options trading", [optionsTopic, cats]);
  assert.deepEqual(ids.sort(), ["cats", "options-futures"]);
});

test("does not match a keyword hiding inside a URL (e.g. /es locale path)", () => {
  const text = "check the news https://ftwr.cloud/es/news/some-article about movies";
  assert.equal(matchesTopic(text, optionsTopic), false);
});

test("matches a real /ES futures mention outside a URL", () => {
  assert.equal(matchesTopic("shorting /ES into the close today", optionsTopic), true);
});

test("word boundary prevents substring match inside another word", () => {
  const noBoundary = { id: "t", keywords: ["iv"], excludeKeywords: [] };
  assert.equal(matchesTopic("my flight has finally arrived", noBoundary), false);
  assert.equal(matchesTopic("checking IV before I sell premium", noBoundary), true);
});
