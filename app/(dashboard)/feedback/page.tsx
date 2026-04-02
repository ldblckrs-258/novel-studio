"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_FEEDBACK_IMAGES,
  MAX_TOTAL_IMAGE_BYTES,
  isAllowedFeedbackImage,
} from "@/lib/feedback-attachments";
import { cn } from "@/lib/utils";
import {
  AlertCircleIcon,
  BugIcon,
  CheckCircle2Icon,
  ImagePlusIcon,
  LightbulbIcon,
  Loader2Icon,
  MessageSquareIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

const ACCEPT_IMAGES =
  "image/jpeg,image/jpg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp";

type ImageItem = { file: File; preview: string };

type FeedbackType = "bug" | "suggestion" | "other";

const TYPE_OPTIONS: {
  value: FeedbackType;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "bug",
    label: "Báo lỗi",
    hint: "Lỗi giao diện, mất dữ liệu, AI không phản hồi…",
    Icon: BugIcon,
  },
  {
    value: "suggestion",
    label: "Góp ý",
    hint: "Ý tưởng tính năng hoặc cải thiện trải nghiệm.",
    Icon: LightbulbIcon,
  },
  {
    value: "other",
    label: "Khác",
    hint: "Câu hỏi hoặc nội dung không thuộc hai mục trên.",
    Icon: MessageSquareIcon,
  },
];

const FEEDBACK_TYPE_THEME: Record<
  FeedbackType,
  {
    optionSelected: string;
    optionFocus: string;
    icon: (selected: boolean) => string;
    cardTop: string;
    badge: string;
    submitAccent: string;
  }
> = {
  bug: {
    optionSelected:
      "border-destructive/55 bg-destructive/10 ring-1 ring-destructive/20",
    optionFocus: "focus-within:ring-destructive/35",
    icon: (selected) => (selected ? "text-destructive" : "text-destructive/45"),
    cardTop: "border-t-destructive",
    badge: "bg-destructive/12 text-destructive ring-1 ring-destructive/25",
    submitAccent:
      "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
  suggestion: {
    optionSelected:
      "border-amber-500/55 bg-amber-500/10 ring-1 ring-amber-500/25 dark:border-amber-400/50 dark:bg-amber-400/10 dark:ring-amber-400/20",
    optionFocus:
      "focus-within:ring-amber-500/40 dark:focus-within:ring-amber-400/35",
    icon: (selected) =>
      selected
        ? "text-amber-700 dark:text-amber-300"
        : "text-amber-600/50 dark:text-amber-400/45",
    cardTop: "border-t-amber-500 dark:border-t-amber-400",
    badge:
      "bg-amber-500/12 text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-400/12 dark:text-amber-50 dark:ring-amber-400/25",
    submitAccent:
      "bg-amber-600 text-white hover:bg-amber-600/90 dark:bg-amber-500 dark:hover:bg-amber-500/90",
  },
  other: {
    optionSelected:
      "border-sky-500/55 bg-sky-500/10 ring-1 ring-sky-500/20 dark:border-sky-400/50 dark:bg-sky-400/10 dark:ring-sky-400/20",
    optionFocus:
      "focus-within:ring-sky-500/35 dark:focus-within:ring-sky-400/35",
    icon: (selected) =>
      selected
        ? "text-sky-700 dark:text-sky-300"
        : "text-sky-600/50 dark:text-sky-400/45",
    cardTop: "border-t-sky-500 dark:border-t-sky-400",
    badge:
      "bg-sky-500/12 text-sky-950 ring-1 ring-sky-500/25 dark:bg-sky-400/12 dark:text-sky-50 dark:ring-sky-400/25",
    submitAccent:
      "bg-sky-600 text-white hover:bg-sky-600/90 dark:bg-sky-500 dark:hover:bg-sky-500/90",
  },
};

const DESC_MIN = 20;
const DESC_MAX = 2000;
const TITLE_MAX = 100;

export default function FeedbackPage() {
  const formId = useId();
  const typeGroupId = `${formId}-type`;
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [imageHint, setImageHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageItemsRef = useRef<ImageItem[]>([]);

  const descTooShort = description.length > 0 && description.length < DESC_MIN;

  const imagesTotalBytes = useMemo(
    () => imageItems.reduce((s, i) => s + i.file.size, 0),
    [imageItems],
  );

  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

  useEffect(() => {
    return () => {
      imageItemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
    };
  }, []);

  const reset = () => {
    setType("bug");
    setTitle("");
    setDescription("");
    setContact("");
    setStatus("idle");
    setErrorMessage(null);
    setImageHint(null);
    setImageItems((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.preview));
      return [];
    });
  };

  const removeImage = (index: number) => {
    setImageItems((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return next;
    });
    setImageHint(null);
  };

  const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const picked = input.files ? Array.from(input.files) : [];
    input.value = "";
    if (picked.length === 0) return;

    setImageHint(null);
    const rejected: string[] = [];
    const next: ImageItem[] = [...imageItems];
    let sum = next.reduce((s, i) => s + i.file.size, 0);

    for (const f of picked) {
      if (next.length >= MAX_FEEDBACK_IMAGES) break;
      if (!isAllowedFeedbackImage(f)) {
        rejected.push("Chỉ JPEG, PNG, GIF, WebP.");
        continue;
      }
      if (sum + f.size > MAX_TOTAL_IMAGE_BYTES) {
        rejected.push("Tổng dung lượng ảnh không được vượt 4 MB.");
        continue;
      }
      sum += f.size;
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }

    setImageItems(next);
    if (rejected.length) {
      setImageHint(rejected[0] ?? null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage(null);

    try {
      const fd = new FormData();
      fd.append("type", type);
      fd.append("title", title.trim());
      fd.append("description", description);
      const c = contact.trim();
      if (c) fd.append("contact", c);
      for (const { file } of imageItems) {
        fd.append("images", file);
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        body: fd,
      });

      const data = (await res.json()) as { error?: string; success?: boolean };

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? "Đã xảy ra lỗi. Vui lòng thử lại.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Không thể kết nối. Kiểm tra mạng và thử lại.");
    }
  };

  if (status === "success") {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 h-[calc(100vh-150px)] flex items-center justify-center">
        <Card className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200 motion-reduce:animate-none">
          <CardContent className="flex flex-col items-center gap-6 px-6 py-12 text-center sm:px-10 sm:py-14">
            <div className="flex size-14 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20">
              <CheckCircle2Icon
                className="size-8 text-green-500"
                aria-hidden
                strokeWidth={1.75}
              />
            </div>
            <div className="max-w-md space-y-3">
              <span
                className={cn(
                  "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                  FEEDBACK_TYPE_THEME[type].badge,
                )}
              >
                {TYPE_OPTIONS.find((o) => o.value === type)?.label ??
                  "Phản hồi"}
              </span>
              <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                Cảm ơn bạn!
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Phản hồi đã được gửi. Chúng tôi sẽ xem xét sớm nhất có thể.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 cursor-pointer"
              onClick={reset}
            >
              Gửi phản hồi khác
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-8 space-y-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Phản hồi &amp; báo lỗi
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Báo lỗi hoặc góp ý để Novel Studio tốt hơn. Thông tin bạn gửi chỉ dùng
          để xử lý phản hồi.
        </p>
      </header>

      <form
        id={formId}
        onSubmit={handleSubmit}
        className="flex flex-col gap-6"
        aria-busy={status === "loading"}
        noValidate
      >
        <Card
          className={cn(
            "overflow-hidden border-t-4 transition-[border-color] duration-200",
            FEEDBACK_TYPE_THEME[type].cardTop,
          )}
        >
          <CardContent className="space-y-6 pt-2">
            <div className="space-y-3">
              <Label
                id={typeGroupId}
                className="text-sm font-medium leading-none"
              >
                Loại phản hồi
              </Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as FeedbackType)}
                className="grid gap-2 sm:grid-cols-3"
                aria-labelledby={typeGroupId}
              >
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.Icon;
                  const itemId = `${formId}-type-${opt.value}`;
                  const theme = FEEDBACK_TYPE_THEME[opt.value];
                  const selected = type === opt.value;
                  return (
                    <label
                      key={opt.value}
                      htmlFor={itemId}
                      className={cn(
                        "relative flex min-h-11 cursor-pointer flex-col gap-1 rounded-lg border px-3 py-3 transition-colors duration-200 sm:min-h-[5.5rem]",
                        "focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-background focus-within:outline-none",
                        theme.optionFocus,
                        selected
                          ? theme.optionSelected
                          : "border-border hover:bg-muted/60",
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <RadioGroupItem
                          value={opt.value}
                          id={itemId}
                          className="shrink-0 hidden"
                        />
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Icon
                            className={cn(
                              "size-4 shrink-0 transition-colors mr-1",
                              selected ? theme.icon(true) : theme.icon(false),
                            )}
                            aria-hidden
                          />
                          {opt.label}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "pl-7 text-xs leading-snug transition-colors",
                          selected
                            ? "text-foreground/80"
                            : "text-muted-foreground",
                        )}
                      >
                        {opt.hint}
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label htmlFor="feedback-title">Tiêu đề</Label>
                <span
                  className="text-xs tabular-nums text-muted-foreground"
                  aria-live="polite"
                >
                  {title.length}/{TITLE_MAX}
                </span>
              </div>
              <Input
                id="feedback-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                required
                placeholder="Tóm tắt ngắn"
                autoComplete="off"
                className="min-h-10"
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label htmlFor="feedback-description">Mô tả chi tiết</Label>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    descTooShort ? "text-destructive" : "text-muted-foreground",
                  )}
                  aria-live="polite"
                >
                  {description.length}/{DESC_MAX}
                  {descTooShort && (
                    <span className="sr-only">
                      {" "}
                      — cần thêm ít nhất {DESC_MIN - description.length} ký tự
                    </span>
                  )}
                </span>
              </div>
              <Textarea
                id="feedback-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                minLength={DESC_MIN}
                maxLength={DESC_MAX}
                required
                rows={7}
                placeholder="Các bước tái hiện (nếu là lỗi), mong đợi vs thực tế…"
                aria-describedby={`${formId}-desc-hint`}
                className="min-h-[140px] resize-y text-base leading-relaxed md:text-sm"
              />
              <p
                id={`${formId}-desc-hint`}
                className={cn(
                  "text-xs leading-relaxed",
                  descTooShort ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {descTooShort
                  ? `Cần ít nhất ${DESC_MIN} ký tự (còn thiếu ${DESC_MIN - description.length}).`
                  : `Tối thiểu ${DESC_MIN} ký tự.`}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <span
                  id={`${formId}-images-label`}
                  className="text-sm font-medium leading-snug"
                >
                  Ảnh đính kèm (tuỳ chọn)
                </span>
                <span
                  className="text-xs tabular-nums text-muted-foreground"
                  aria-live="polite"
                >
                  {imageItems.length}/{MAX_FEEDBACK_IMAGES} ·{" "}
                  {(imagesTotalBytes / (1024 * 1024)).toFixed(1)} / 4 MB
                </span>
              </div>
              <input
                ref={fileInputRef}
                id={`${formId}-images`}
                type="file"
                accept={ACCEPT_IMAGES}
                multiple
                aria-labelledby={`${formId}-images-label`}
                tabIndex={-1}
                className="fixed top-0 left-0 h-px w-px overflow-hidden opacity-0"
                onChange={onPickImages}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer gap-2"
                disabled={
                  imageItems.length >= MAX_FEEDBACK_IMAGES ||
                  imagesTotalBytes >= MAX_TOTAL_IMAGE_BYTES ||
                  status === "loading"
                }
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlusIcon className="size-4" aria-hidden />
                Thêm ảnh
              </Button>
              {imageHint && (
                <p className="text-xs text-destructive" role="status">
                  {imageHint}
                </p>
              )}
              {imageItems.length > 0 && (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {imageItems.map((item, index) => (
                    <li
                      key={item.preview}
                      className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob preview */}
                      <img
                        src={item.preview}
                        alt=""
                        className="size-full object-cover"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute top-1.5 right-1.5 size-8 min-h-8 min-w-8 cursor-pointer shadow-sm"
                        onClick={() => removeImage(index)}
                        aria-label={`Xóa ảnh ${index + 1}`}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-contact">Liên hệ (tuỳ chọn)</Label>
              <Input
                id="feedback-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={200}
                placeholder="Email hoặc @telegram"
                autoComplete="email"
                className="min-h-10"
              />
              <p className="text-xs text-muted-foreground">
                Chỉ dùng khi bạn muốn được liên hệ lại.
              </p>
            </div>

            {status === "error" && errorMessage && (
              <Alert variant="destructive" className="border-destructive/40">
                <AlertCircleIcon className="size-4" aria-hidden />
                <AlertTitle>Không gửi được</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 py-3 border-t bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Bằng việc gửi, bạn đồng ý nội dung được dùng để cải thiện sản
              phẩm.
            </p>
            <Button
              type="submit"
              disabled={status === "loading"}
              className={cn(
                "min-h-8 w-full cursor-pointer gap-2 border-0 sm:w-auto",
                FEEDBACK_TYPE_THEME[type].submitAccent,
              )}
            >
              {status === "loading" ? (
                <>
                  <Loader2Icon
                    className="size-4 shrink-0 motion-safe:animate-spin"
                    aria-hidden
                  />
                  Đang gửi…
                </>
              ) : (
                "Gửi phản hồi"
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}
