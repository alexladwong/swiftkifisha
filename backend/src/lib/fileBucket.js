/**
 * File bucket (UploadThing) — server-side file storage.
 *
 * Uploads happen HERE (backend → UploadThing), never from the browser, so the
 * token stays server-side. Files default to the app ACL; access to package
 * photos is still enforced by the API's /files route, which streams the
 * bucket object behind authorization.
 *
 * If UPLOADTHING_TOKEN is not configured the helpers report "not configured"
 * and callers keep using local disk — no fake uploads, no pretend bucket.
 */
import fs from "node:fs";
import { UTApi } from "uploadthing/server";

export function bucketConfigured() {
  return Boolean(process.env.UPLOADTHING_TOKEN);
}

let _ut = null;
function ut() {
  if (!_ut) _ut = new UTApi({ token: process.env.UPLOADTHING_TOKEN });
  return _ut;
}

/**
 * Uploads one local file into the bucket.
 * Returns { key, url } or throws with a descriptive error.
 */
export async function uploadToBucket({ filePath, name, mime, customId }) {
  if (!bucketConfigured()) {
    throw new Error("Bucket not configured — UPLOADTHING_TOKEN missing.");
  }
  const buffer = fs.readFileSync(filePath);
  const file = new File([buffer], name || "file", mime ? { type: mime } : undefined);
  const result = await ut().uploadFiles([file], {
    metadata: { uploadedBy: "swiftkifisha-backend" },
  });
  const first = Array.isArray(result) ? result[0] : result;
  if (!first || first.error) {
    throw new Error(first?.error?.message || "UploadThing upload failed.");
  }
  return { key: first.data.key, url: first.data.url, name: first.data.name, size: first.data.size };
}

/** Deletes one object by key (used when a photo is replaced/removed). */
export async function deleteFromBucket(key) {
  if (!bucketConfigured() || !key) return false;
  try {
    const res = await ut().deleteFiles(key);
    return !res?.error;
  } catch (err) {
    console.error("[bucket] delete failed:", err?.message ?? err);
    return false;
  }
}
