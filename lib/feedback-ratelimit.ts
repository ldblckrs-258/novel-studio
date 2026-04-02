import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { type NextRequest, NextResponse } from "next/server";

function getUpstashRestCredentials(): { url: string; token: string } | null {
  const url = process.env.NOVEL_STUDIO_KV_REST_API_URL?.trim();
  const token = process.env.NOVEL_STUDIO_KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

let ratelimit: Ratelimit | null = null;

function getFeedbackRatelimit(): Ratelimit | null {
  const creds = getUpstashRestCredentials();
  if (!creds) return null;
  const { url, token } = creds;

  if (!ratelimit) {
    const redis = new Redis({ url, token });
    const max = Number.parseInt(
      process.env.FEEDBACK_RATE_LIMIT_MAX ?? "5",
      10,
    );
    const limit = Number.isFinite(max) && max > 0 ? max : 5;
    const window = (process.env.FEEDBACK_RATE_LIMIT_WINDOW?.trim() ||
      "1 m") as Duration;

    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: "novel-studio:feedback",
    });
  }

  return ratelimit;
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  return "unknown";
}

export async function checkFeedbackRateLimit(
  req: NextRequest,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const rl = getFeedbackRatelimit();
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
        { error: "Quá nhiều yêu cầu. Thử lại sau." },
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
