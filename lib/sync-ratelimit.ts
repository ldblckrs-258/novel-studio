import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { type NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/feedback-ratelimit";

function getUpstashRestCredentials(): { url: string; token: string } | null {
  const url = process.env.NOVEL_STUDIO_KV_REST_API_URL?.trim();
  const token = process.env.NOVEL_STUDIO_KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

let syncUploadRatelimit: Ratelimit | null = null;

function getSyncUploadRatelimit(): Ratelimit | null {
  const creds = getUpstashRestCredentials();
  if (!creds) return null;
  const { url, token } = creds;

  if (!syncUploadRatelimit) {
    const redis = new Redis({ url, token });
    const max = Number.parseInt(process.env.SYNC_RATE_LIMIT_MAX ?? "3", 10);
    const limit = Number.isFinite(max) && max > 0 ? max : 5;
    const window = (process.env.SYNC_RATE_LIMIT_WINDOW?.trim() ||
      "1 d") as Duration;

    syncUploadRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: "novel-studio:sync-upload",
    });
  }

  return syncUploadRatelimit;
}

export async function checkSyncUploadRateLimit(
  req: NextRequest,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const rl = getSyncUploadRatelimit();
  if (!rl) return { ok: true };

  const ip = getClientIp(req);
  const result = await rl.limit(ip);
  if (result.pending) await result.pending;

  if (!result.success) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Quá nhiều yêu cầu đồng bộ. Thử lại sau." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
          },
        },
      ),
    };
  }

  return { ok: true };
}
