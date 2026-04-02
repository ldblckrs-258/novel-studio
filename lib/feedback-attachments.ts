export const MAX_FEEDBACK_IMAGES = 3;
export const MAX_TOTAL_IMAGE_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export function normalizeImageMime(file: File): string {
  const t = file.type?.trim().toLowerCase();
  if (t) {
    if (t === "image/jpg" || t === "image/pjpeg") return "image/jpeg";
    if (t === "image/x-png") return "image/png";
    return t;
  }
  const n = file.name.toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  return "";
}

export function isAllowedFeedbackImage(file: File): boolean {
  const m = normalizeImageMime(file);
  return m !== "" && ALLOWED_MIME.has(m);
}
