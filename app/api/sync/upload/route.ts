import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { checkSyncUploadRateLimit } from "@/lib/sync-ratelimit";

export const maxDuration = 60;

const CODE_PATTERN = /^[0-9A-F]{8}$/;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const TOKEN_TTL_MS = 2 * 60 * 1000;
const MAX_SYNC_TTL_MS = 15 * 60 * 1000;

type SyncClientPayload = {
  code: string;
  expiresAt: string;
};

function parseClientPayload(raw: string | null): SyncClientPayload {
  if (!raw) {
    throw new Error("Thiếu clientPayload.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("clientPayload không hợp lệ.");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { code?: unknown }).code !== "string" ||
    typeof (parsed as { expiresAt?: unknown }).expiresAt !== "string"
  ) {
    throw new Error("clientPayload thiếu trường bắt buộc.");
  }

  const code = (parsed as { code: string }).code.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    throw new Error("Mã đồng bộ không hợp lệ.");
  }

  const expiresAt = (parsed as { expiresAt: string }).expiresAt;
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
    throw new Error("Thời điểm hết hạn không hợp lệ.");
  }
  if (expiresMs - Date.now() > MAX_SYNC_TTL_MS + 30_000) {
    throw new Error("Thời gian hiệu lực vượt quá giới hạn cho phép.");
  }

  return { code, expiresAt };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

  if (body.type === "blob.generate-client-token") {
    const rate = await checkSyncUploadRateLimit(req);
    if (!rate.ok) return rate.response;
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const parsedPayload = parseClientPayload(clientPayload);
        const expectedPathname = `sync/${parsedPayload.code}.json`;
        if (pathname !== expectedPathname) {
          throw new Error("Path upload không hợp lệ.");
        }

        return {
          allowedContentTypes: ["application/json"],
          addRandomSuffix: false,
          allowOverwrite: false,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          validUntil: Date.now() + TOKEN_TTL_MS,
        };
      },
      onUploadCompleted: async ({ tokenPayload }) => {
        parseClientPayload(tokenPayload ?? null);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu lên cloud.",
      },
      { status: 500 },
    );
  }
}
