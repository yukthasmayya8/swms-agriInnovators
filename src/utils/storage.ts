import fs from "fs";
import path from "path";
import { getStore } from "@netlify/blobs";
import { env } from "../config/env";

export interface StorageAdapter {
  /** Persists a file buffer and returns a URL/path the rest of the app can use to fetch it later. */
  save(destinationKey: string, data: Buffer): Promise<string>;
  read(url: string): Promise<Buffer>;
}

/**
 * Local-disk storage — used for STORAGE_DRIVER=local (the default, and what
 * this reference implementation runs on). Swapping STORAGE_DRIVER=s3 would
 * plug in an S3-backed adapter implementing the same interface (EXT-01);
 * nothing else in the codebase would need to change.
 */
class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;
  constructor(baseDir: string) {
    this.baseDir = baseDir;
    fs.mkdirSync(this.baseDir, { recursive: true });
  }
  async save(destinationKey: string, data: Buffer): Promise<string> {
    const fullPath = path.join(this.baseDir, destinationKey);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, data);
    return `local://${destinationKey}`;
  }
  async read(url: string): Promise<Buffer> {
    const key = url.replace(/^local:\/\//, "");
    return fs.readFileSync(path.join(this.baseDir, key));
  }
}

/**
 * Netlify Blobs storage — the default when running on Netlify (including
 * `netlify dev`), so uploads persist across serverless invocations and are
 * readable from the background functions that process them.
 */
class BlobsStorageAdapter implements StorageAdapter {
  private store() {
    return getStore({ name: "swms-uploads", consistency: "strong" });
  }
  async save(destinationKey: string, data: Buffer): Promise<string> {
    const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    await this.store().set(destinationKey, bytes);
    return `blobs://${destinationKey}`;
  }
  async read(url: string): Promise<Buffer> {
    const key = url.replace(/^blobs:\/\//, "");
    const data = await this.store().get(key, { type: "arrayBuffer" });
    if (!data) throw new Error(`Stored file not found: ${key}`);
    return Buffer.from(data);
  }
}

export const storage: StorageAdapter = env.storage.driver === "blobs"
  ? new BlobsStorageAdapter()
  : new LocalStorageAdapter(env.storage.localDir);
