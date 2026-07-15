# atproto-feedgen

A multi-topic [AT Protocol](https://atproto.com) feed generator for Bluesky, running entirely on
Cloudflare Workers. First topic: options/futures trading talk. Add more topics via the admin API,
no redeploy needed.

## How it works

```mermaid
flowchart LR
    JS[Jetstream firehose] -- WebSocket --> DO[Durable Object: FirehoseListener]
    DO -- keyword match per topic --> D1[(D1: topics, posts)]
    Client[Bluesky app] -- getFeedSkeleton --> W[Worker]
    Admin -- bearer token --> W
    W -- read --> D1
```

- A Durable Object holds a persistent connection to [Jetstream](https://github.com/bluesky-social/jetstream)
  (Bluesky's lightweight JSON firehose), tests each post against every topic's keyword list, and
  stores matches in D1.
- The Worker serves the standard feed generator XRPC endpoints (`describeFeedGenerator`,
  `getFeedSkeleton`) plus an admin API for managing topics.
- Topics live in D1 — adding one is an API call, not a deploy. Publishing the corresponding
  `app.bsky.feed.generator` record to a real Bluesky account (a separate one-time step, see below)
  is what makes it show up in the Bluesky app.

## Setup

```bash
npm install
wrangler d1 create atproto-feedgen-db   # paste the resulting database_id into wrangler.toml
npm run migrate:local                    # or migrate:remote after first deploy
wrangler secret put ADMIN_TOKEN
npm run dev
```

Set `FEEDGEN_HOSTNAME` and `FEEDGEN_PUBLISHER_DID` in `wrangler.toml` once you know your custom
domain and the DID of the Bluesky account that will own the feed generator records.

## Adding a topic

```bash
curl -X POST https://<host>/admin/topics \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rkey":"options-futures","displayName":"Options & Futures Talk","keywords":["options","futures","theta","/es","/nq"],"excludeKeywords":["nfl futures"]}'
```

Then publish the generator record once so Bluesky's directory picks it up:

```bash
BSKY_HANDLE=you.bsky.social BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx FEEDGEN_HOSTNAME=<host> \
  npm run publish-feed -- options-futures "Options & Futures Talk" "Options and futures trading discussion on Bluesky."
```

## Test

```bash
npm test
```
