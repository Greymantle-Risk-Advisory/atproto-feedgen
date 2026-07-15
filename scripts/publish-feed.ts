// One-off script: publishes an app.bsky.feed.generator record to your PDS repo
// so the feed shows up in Bluesky's feed directory/search.
//
// Usage:
//   BSKY_HANDLE=you.bsky.social BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
//   FEEDGEN_HOSTNAME=feeds.greymantlerisk.com \
//   node --experimental-strip-types scripts/publish-feed.ts <rkey> "<Display Name>" "<description>"

import { AtpAgent } from "@atproto/api";

const [rkey, displayName, description] = process.argv.slice(2);
if (!rkey || !displayName) {
  console.error('Usage: publish-feed.ts <rkey> "<Display Name>" "<description>"');
  process.exit(1);
}

const handle = process.env.BSKY_HANDLE;
const appPassword = process.env.BSKY_APP_PASSWORD;
const hostname = process.env.FEEDGEN_HOSTNAME;
if (!handle || !appPassword || !hostname) {
  console.error("Set BSKY_HANDLE, BSKY_APP_PASSWORD, FEEDGEN_HOSTNAME env vars.");
  process.exit(1);
}

const agent = new AtpAgent({ service: "https://bsky.social" });
await agent.login({ identifier: handle, password: appPassword });

await agent.com.atproto.repo.putRecord({
  repo: agent.session!.did,
  collection: "app.bsky.feed.generator",
  rkey,
  record: {
    did: `did:web:${hostname}`,
    displayName,
    description: description ?? "",
    createdAt: new Date().toISOString(),
  },
});

console.log(`Published feed generator record: at://${agent.session!.did}/app.bsky.feed.generator/${rkey}`);
