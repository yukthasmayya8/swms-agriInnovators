import fs from "fs";
import path from "path";
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

export const storage: StorageAdapter = new LocalStorageAdapter(env.storage.localDir);
