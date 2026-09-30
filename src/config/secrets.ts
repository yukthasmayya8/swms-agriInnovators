import crypto from "crypto";
import { getStore } from "@netlify/blobs";

const SECRET_NAMES = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;

let ready: Promise<void> | null = null;

/**
 * On Netlify, JWT secrets come from site environment variables when set.
 * If they aren't, a random secret is generated once and kept in a private
 * Blobs store, so every function instance signs and verifies with the same key.
 */
export function ensureSecrets(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const store = getStore({ name: "swms-secrets", consistency: "strong" });
      for (const name of SECRET_NAMES) {
        if (process.env[name]) continue;
        let value = await store.get(name, { type: "text" });
        if (!value) {
          await store.set(name, crypto.randomBytes(64).toString("hex"), { onlyIfNew: true });
          value = await store.get(name, { type: "text" }); // re-read in case another instance won the race
        }
        if (!value) throw new Error(`Unable to provision ${name}`);
        process.env[name] = value;
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
