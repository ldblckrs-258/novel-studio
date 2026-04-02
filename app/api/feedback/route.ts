import {
  MAX_FEEDBACK_IMAGES,
  MAX_TOTAL_IMAGE_BYTES,
  isAllowedFeedbackImage,
} from "@/lib/feedback-attachments";
import { checkFeedbackRateLimit } from "@/lib/feedback-ratelimit";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const FEEDBACK_TYPES = ["bug", "suggestion", "other"] as const;
type FeedbackType = (typeof FEEDBACK_TYPES)[number];

function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isFeedbackType(v: unknown): v is FeedbackType {
  return typeof v === "string" && FEEDBACK_TYPES.includes(v as FeedbackType);
}

type ValidatedFields = {
  type: FeedbackType;
  title: string;
  description: string;
  contact?: string;
};

function validateFields(
  type: unknown,
  title: unknown,
  description: unknown,
  contact: unknown,
): { ok: true; data: ValidatedFields } | { ok: false; error: string; status: number } {
  if (!isFeedbackType(type)) {
    return { ok: false, error: "Invalid type", status: 400 };
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    return { ok: false, error: "Title is required", status: 400 };
  }
  if (title.length > 100) {
    return { ok: false, error: "Title too long", status: 400 };
  }

  if (typeof description !== "string") {
    return { ok: false, error: "Description is required", status: 400 };
  }
  if (description.trim().length < 20) {
    return {
      ok: false,
      error: "Description must be at least 20 characters",
      status: 400,
    };
  }
  if (description.length > 2000) {
    return { ok: false, error: "Description too long", status: 400 };
  }

  let contactStr: string | undefined;
  if (contact !== undefined && contact !== null && contact !== "") {
    if (typeof contact !== "string") {
      return { ok: false, error: "Invalid contact", status: 400 };
    }
    if (contact.length > 200) {
      return { ok: false, error: "Contact too long", status: 400 };
    }
    contactStr = contact.trim() || undefined;
  }

  return {
    ok: true,
    data: {
      type,
      title: title.trim(),
      description,
      contact: contactStr,
    },
  };
}

function validateImageFiles(
  files: File[],
): { ok: true } | { ok: false; error: string } {
  if (files.length > MAX_FEEDBACK_IMAGES) {
    return { ok: false, error: `Tối đa ${MAX_FEEDBACK_IMAGES} ảnh.` };
  }
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    return {
      ok: false,
      error: "Tổng dung lượng ảnh tối đa 4 MB.",
    };
  }

  for (const f of files) {
    if (!isAllowedFeedbackImage(f)) {
      return {
        ok: false,
        error: "Chỉ chấp nhận ảnh JPEG, PNG, GIF hoặc WebP.",
      };
    }
  }
  return { ok: true };
}

function buildTelegramText(data: ValidatedFields, imageCount: number): string {
  const typeHeader =
    data.type === "bug"
      ? "🐛 [BÁO LỖI]"
      : data.type === "suggestion"
        ? "💡 [GÓP Ý]"
        : "📋 [KHÁC]";

  const lines: string[] = [
    `<b>${escapeTelegramHtml(typeHeader)}</b>`,
    "",
    `<b>${escapeTelegramHtml(data.title)}</b>`,
    "",
    escapeTelegramHtml(data.description.trim()),
  ];

  if (data.contact) {
    lines.push("", `📧 ${escapeTelegramHtml(data.contact)}`);
  }

  if (imageCount > 0) {
    lines.push("", `📎 ${imageCount} ảnh đính kèm (tin nhắn tiếp theo)`);
  }

  const now = new Date().toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  lines.push("", `⏱ ${escapeTelegramHtml(now)}`);

  return lines.join("\n");
}

async function telegramSendMessage(
  token: string,
  chatId: string,
  text: string,
  messageThreadId?: number,
): Promise<{ ok: boolean; description?: string }> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const sendPayload: Record<string, string | number> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (messageThreadId !== undefined) {
    sendPayload.message_thread_id = messageThreadId;
  }

  const tgRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sendPayload),
  });

  return (await tgRes.json()) as { ok: boolean; description?: string };
}

async function telegramSendPhoto(
  token: string,
  chatId: string,
  file: File,
  caption: string,
  messageThreadId?: number,
): Promise<{ ok: boolean; description?: string }> {
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;
  const fd = new FormData();
  fd.append("chat_id", chatId);
  fd.append("photo", file, file.name || "image.jpg");
  fd.append("caption", caption);
  if (messageThreadId !== undefined) {
    fd.append("message_thread_id", String(messageThreadId));
  }

  const tgRes = await fetch(url, {
    method: "POST",
    body: fd,
  });

  return (await tgRes.json()) as { ok: boolean; description?: string };
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json(
      { error: "Feedback service is not configured." },
      { status: 503 },
    );
  }

  const threadRaw = process.env.TELEGRAM_MESSAGE_THREAD_ID?.trim();
  let messageThreadId: number | undefined;
  if (threadRaw) {
    const n = Number.parseInt(threadRaw, 10);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json(
        { error: "Invalid TELEGRAM_MESSAGE_THREAD_ID" },
        { status: 503 },
      );
    }
    messageThreadId = n;
  }

  const rate = await checkFeedbackRateLimit(req);
  if (!rate.ok) return rate.response;

  const contentType = req.headers.get("content-type") ?? "";
  let type: unknown;
  let title: unknown;
  let description: unknown;
  let contact: unknown;
  let imageFiles: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid multipart body" },
        { status: 400 },
      );
    }
    type = form.get("type");
    title = form.get("title");
    description = form.get("description");
    const c = form.get("contact");
    contact = c === null || c === "" ? undefined : c;
    imageFiles = form
      .getAll("images")
      .filter((x): x is File => x instanceof File && x.size > 0);
  } else if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    type = b.type;
    title = b.title;
    description = b.description;
    contact = b.contact;
  } else {
    return NextResponse.json(
      { error: "Unsupported Content-Type" },
      { status: 415 },
    );
  }

  const validated = validateFields(type, title, description, contact);
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error },
      { status: validated.status },
    );
  }

  const imgCheck = validateImageFiles(imageFiles);
  if (!imgCheck.ok) {
    return NextResponse.json({ error: imgCheck.error }, { status: 400 });
  }

  const text = buildTelegramText(validated.data, imageFiles.length);

  if (text.length > 4096) {
    return NextResponse.json(
      { error: "Message too long for Telegram" },
      { status: 400 },
    );
  }

  const msgResult = await telegramSendMessage(
    token,
    chatId,
    text,
    messageThreadId,
  );

  if (!msgResult.ok) {
    return NextResponse.json(
      { error: msgResult.description ?? "Failed to send to Telegram" },
      { status: 502 },
    );
  }

  for (let i = 0; i < imageFiles.length; i++) {
    const caption =
      imageFiles.length > 1
        ? `📎 Ảnh ${i + 1}/${imageFiles.length}`
        : "📎 Ảnh đính kèm";
    const photoResult = await telegramSendPhoto(
      token,
      chatId,
      imageFiles[i],
      caption,
      messageThreadId,
    );
    if (!photoResult.ok) {
      return NextResponse.json(
        {
          error:
            photoResult.description ??
            `Gửi ảnh ${i + 1} thất bại (tin nhắn chữ đã gửi).`,
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
