import multer from "multer";

// Files are buffered in memory then handed to the storage adapter — fine at the
// 50MB/20MB caps enforced in the service layer; a very high-traffic production
// deployment would stream directly to disk/S3 instead.
export const upload = multer({ storage: multer.memoryStorage() });
