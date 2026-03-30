"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";
import {
  CHAPTER_PRESETS,
  parseCustomRegex,
  splitChapters,
  testPattern,
  type ChapterCandidate,
} from "@/lib/import";
import {
  CheckIcon,
  EyeIcon,
  FileTextIcon,
  PencilIcon,
  SettingsIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────

type Step = "input" | "configure" | "preview" | "confirm";

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "input", label: "Nhập liệu", icon: UploadIcon },
  { key: "configure", label: "Cấu hình", icon: SettingsIcon },
  { key: "preview", label: "Xem trước", icon: EyeIcon },
  { key: "confirm", label: "Xác nhận", icon: CheckIcon },
];

function countWords(text: string): number {
  const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  const latin = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (cjk?.length ?? 0) + latin.length;
}

// ─── Component ──────────────────────────────────────────────

export function NovelImportWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [step, setStep] = useState<Step>("input");
  const [rawText, setRawText] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("vietnamese");
  const [customRegex, setCustomRegex] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [chapters, setChapters] = useState<ChapterCandidate[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [novelTitle, setNovelTitle] = useState("");
  const [novelDescription, setNovelDescription] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const wordCount = rawText ? countWords(rawText) : 0;
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // ── File Upload ─────────────────────────────────────────

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setRawText(text);
      };
      reader.readAsText(file);
    },
    [],
  );

  // ── Pattern Testing ─────────────────────────────────────

  const getActivePattern = useCallback((): RegExp | null => {
    if (useCustom) {
      return parseCustomRegex(customRegex);
    }
    const preset = CHAPTER_PRESETS[selectedPreset];
    return preset
      ? new RegExp(preset.pattern.source, preset.pattern.flags)
      : null;
  }, [useCustom, customRegex, selectedPreset]);

  const handleTest = useCallback(() => {
    const pattern = getActivePattern();
    if (!pattern) {
      toast.error("Biểu thức regex không hợp lệ");
      return;
    }
    const count = testPattern(rawText, pattern);
    setMatchCount(count);
  }, [rawText, getActivePattern]);

  const handleSplit = useCallback(() => {
    const pattern = getActivePattern();
    if (!pattern) {
      toast.error("Biểu thức regex không hợp lệ");
      return;
    }
    const result = splitChapters(rawText, pattern);
    setChapters(result);
    setStep("preview");
  }, [rawText, getActivePattern]);

  // ── Chapter Editing ─────────────────────────────────────

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditTitle(chapters[index].title);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    setChapters((prev) =>
      prev.map((ch, i) =>
        i === editingIndex ? { ...ch, title: editTitle } : ch,
      ),
    );
    setEditingIndex(null);
  };

  const deleteChapter = (index: number) => {
    setChapters((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Import ──────────────────────────────────────────────

  const handleImport = async () => {
    if (!novelTitle.trim()) {
      toast.error("Vui lòng nhập tiêu đề tiểu thuyết");
      return;
    }
    if (chapters.length === 0) {
      toast.error("Không có chương để nhập");
      return;
    }

    setIsImporting(true);
    try {
      const now = new Date();
      const novelId = crypto.randomUUID();

      await db.transaction(
        "rw",
        [db.novels, db.chapters, db.scenes],
        async () => {
          await db.novels.add({
            id: novelId,
            title: novelTitle.trim(),
            description: novelDescription.trim(),
            createdAt: now,
            updatedAt: now,
          });

          for (let i = 0; i < chapters.length; i++) {
            const ch = chapters[i];
            const chapterId = crypto.randomUUID();
            await db.chapters.add({
              id: chapterId,
              novelId,
              title: ch.title,
              order: i,
              createdAt: now,
              updatedAt: now,
            });

            // One scene per chapter with full content
            await db.scenes.add({
              id: crypto.randomUUID(),
              chapterId,
              novelId,
              title: ch.title,
              content: ch.content,
              order: 0,
              wordCount: ch.wordCount,
              version: 0,
              versionType: "manual",
              isActive: 1,
              createdAt: now,
              updatedAt: now,
            });
          }
        },
      );

      toast.success(`Đã nhập "${novelTitle}" với ${chapters.length} chương`);
      router.push("/");
    } catch (error) {
      toast.error(
        `Nhập thất bại: ${error instanceof Error ? error.message : "Lỗi không xác định"}`,
      );
    } finally {
      setIsImporting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1 justify-center sm:gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && (
              <div
                className={`h-px w-4 sm:w-8 ${i <= stepIndex ? "bg-primary" : "bg-border"}`}
              />
            )}
            <button
              onClick={() => {
                if (i < stepIndex) setStep(s.key);
              }}
              disabled={i > stepIndex}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors sm:px-3 ${
                i === stepIndex
                  ? "bg-primary text-primary-foreground"
                  : i < stepIndex
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <s.icon className="size-3.5 shrink-0" />
              <span className={i === stepIndex ? "sm:inline" : "hidden sm:inline"}>
                {s.label}
              </span>
            </button>
          </div>
        ))}
      </div>

      {/* Step 1: Input */}
      {step === "input" && (
        <Card>
          <CardHeader>
            <CardTitle>Nhập văn bản tiểu thuyết</CardTitle>
            <CardDescription>
              Dán văn bản hoặc tải lên file .txt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="novel-text">Văn bản tiểu thuyết</Label>
              <Textarea
                id="novel-text"
                placeholder="Dán văn bản tiểu thuyết tại đây..."
                className="mt-1.5 h-[300px] max-h-[300px] resize-none overflow-y-auto font-mono text-sm"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              {rawText && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {wordCount.toLocaleString()} từ &middot;{" "}
                  {rawText.length.toLocaleString()} ký tự
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">hoặc</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileTextIcon className="mr-1.5 size-3.5" />
                Tải file .txt
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep("configure")}
                disabled={!rawText.trim()}
              >
                Tiếp
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Configure */}
      {step === "configure" && (
        <Card>
          <CardHeader>
            <CardTitle>Cấu hình tách chương</CardTitle>
            <CardDescription>
              Chọn mẫu có sẵn hoặc nhập regex tùy chỉnh để phát hiện tiêu đề
              chương.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mẫu có sẵn</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(CHAPTER_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedPreset(key);
                      setUseCustom(false);
                      setMatchCount(null);
                    }}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                      !useCustom && selectedPreset === key
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {preset.pattern.source}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-custom"
                  checked={useCustom}
                  onChange={(e) => {
                    setUseCustom(e.target.checked);
                    setMatchCount(null);
                  }}
                  className="size-4 rounded border-border"
                />
                <Label htmlFor="use-custom">Sử dụng regex tùy chỉnh</Label>
              </div>
              {useCustom && (
                <Input
                  placeholder="e.g. /^Phần \d+/gm or ^VOLUME \d+"
                  value={customRegex}
                  onChange={(e) => {
                    setCustomRegex(e.target.value);
                    setMatchCount(null);
                  }}
                />
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleTest}>
                Kiểm tra mẫu
              </Button>
              {matchCount !== null && (
                <Badge variant="secondary">Tìm thấy {matchCount} kết quả</Badge>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("input")}>
                Quay lại
              </Button>
              <Button onClick={handleSplit}>Tách & Xem trước</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Xem trước chương</CardTitle>
            <CardDescription>
              Phát hiện {chapters.length} chương &middot;{" "}
              {chapters
                .reduce((sum, ch) => sum + ch.wordCount, 0)
                .toLocaleString()}{" "}
              tổng số từ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[360px] pr-4">
              <div className="space-y-2">
                {chapters.map((ch, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <span className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {editingIndex === i ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") setEditingIndex(null);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={saveEdit}
                          >
                            <CheckIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingIndex(null)}
                          >
                            <XIcon className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium">{ch.title}</p>
                      )}
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {ch.content.slice(0, 150)}
                        {ch.content.length > 150 ? "..." : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/60">
                        {ch.wordCount.toLocaleString()} từ
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEditing(i)}
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteChapter(i)}
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep("configure")}>
                Quay lại
              </Button>
              <Button
                onClick={() => setStep("confirm")}
                disabled={chapters.length === 0}
              >
                Tiếp
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirm */}
      {step === "confirm" && (
        <Card>
          <CardHeader>
            <CardTitle>Xác nhận nhập</CardTitle>
            <CardDescription>
              Thiết lập thông tin tiểu thuyết và nhập.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="novel-title">Tiêu đề tiểu thuyết</Label>
              <Input
                id="novel-title"
                placeholder="Nhập tiêu đề tiểu thuyết"
                value={novelTitle}
                onChange={(e) => setNovelTitle(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="novel-desc">Mô tả (tùy chọn)</Label>
              <Textarea
                id="novel-desc"
                placeholder="Mô tả ngắn..."
                value={novelDescription}
                onChange={(e) => setNovelDescription(e.target.value)}
                className="mt-1.5"
                rows={3}
              />
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium">Tóm tắt nhập</p>
              <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                <span>{chapters.length} chương</span>
                <span>&middot;</span>
                <span>
                  {chapters
                    .reduce((sum, ch) => sum + ch.wordCount, 0)
                    .toLocaleString()}{" "}
                  từ
                </span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("preview")}>
                Quay lại
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? "Đang nhập..." : "Nhập tiểu thuyết"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
