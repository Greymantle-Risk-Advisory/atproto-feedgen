interface Env {
  DB: D1Database;
  FIREHOSE_LISTENER: DurableObjectNamespace<import("./durable-object.ts").FirehoseListener>;
  FEEDGEN_HOSTNAME: string;
  FEEDGEN_PUBLISHER_DID: string;
  ADMIN_TOKEN: string;
}
