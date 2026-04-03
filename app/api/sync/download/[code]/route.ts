import { list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const CODE_PATTERN = /^[0-9A-F]{8}$/;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await context.params;
  const code = rawCode.trim().toUpperCase();

  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "Mã đồng bộ không hợp lệ." }, { status: 400 });
  }

  const pathname = `sync/${code}.json`;

  try {
    const listed = await list({ prefix: pathname, limit: 1 });
    const targetBlob = listed.blobs.find((blob) => blob.pathname === pathname);

    if (!targetBlob) {
      return NextResponse.json({ error: "Không tìm thấy dữ liệu đồng bộ." }, { status: 404 });
    }

    return NextResponse.json({
      url: targetBlob.url,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu đồng bộ.",
      },
      { status: 500 },
    );
  }
}
