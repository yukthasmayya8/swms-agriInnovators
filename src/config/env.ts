import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  // Leave unset to use Netlify Database (see src/config/db.ts).
  databaseUrl: process.env.DATABASE_URL || "",
  // Leave unset to run background jobs through Netlify Background Functions (see src/workers/queues.ts).
  redisUrl: process.env.REDIS_URL || "",
  jwt: {
    // Read lazily so Netlify Functions can provision them first (see src/config/secrets.ts).
    get accessSecret() {
      return required("JWT_ACCESS_SECRET");
    },
    get refreshSecret() {
      return required("JWT_REFRESH_SECRET");
    },
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d"
  },
  storage: {
    // Defaults to Netlify Blobs when running on Netlify, local disk otherwise.
    driver: (process.env.STORAGE_DRIVER || ((globalThis as any).Netlify ? "blobs" : "local")) as "local" | "blobs" | "s3",
    localDir: process.env.LOCAL_STORAGE_DIR || "./storage/uploads",
    s3Bucket: process.env.AWS_S3_BUCKET || "",
    s3Region: process.env.AWS_REGION || ""
  }
};
