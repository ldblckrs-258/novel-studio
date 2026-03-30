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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { db } from "@/lib/db";
import { useNovels } from "@/lib/hooks";
import { getAdapters } from "@/lib/scraper/adapters";
import {
  getExtensionId,
  getScrapeTimeout,
  setExtensionId,
  setScrapeTimeout,
} from "@/lib/scraper/extension-bridge";
import { type ScraperStep, useScraperStore } from "@/lib/stores/scraper";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookPlusIcon,
  CheckIcon,
  CircleDotIcon,
  ClipboardCopyIcon,
  DownloadIcon,
  EyeIcon,
  GlobeIcon,
  LibraryIcon,
  ListChecksIcon,
  LoaderIcon,
  PlusIcon,
  RefreshCwIcon,
  SquareIcon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Helpers ───────────────────────────────────────────────

function countWords(text: string): number {
  const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  const latin = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (cjk?.length ?? 0) + latin.length;
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent ?? "";
}

// ─── Steps ─────────────────────────────────────────────────

const STEPS: { key: ScraperStep; label: string; icon: React.ElementType }[] = [
  { key: "url", label: "URL", icon: GlobeIcon },
  { key: "select", label: "Chọn chương", icon: ListChecksIcon },
  { key: "scraping", label: "Scraping", icon: LoaderIcon },
  { key: "preview", label: "Xem trước", icon: EyeIcon },
];

// ─── Main ──────────────────────────────────────────────────

export default function ScraperPage() {
  const router = useRouter();
  const store = useScraperStore();
  const stepIndex = STEPS.findIndex((s) => s.key === store.step);

  useEffect(() => {
    store.checkExtension();
    return () => store.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Scraper
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nhập truyện từ website bên ngoài vào hệ thống.
          </p>
        </div>
        <DebugToolbar />
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-6">
        {/* Step indicator */}
        <nav className="flex items-center justify-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              {i > 0 && (
                <ArrowRightIcon
                  className={`size-3 shrink-0 ${i <= stepIndex ? "text-primary" : "text-border"}`}
                />
              )}
              <button
                onClick={() => {
                  if (i < stepIndex) store.setStep(s.key);
                }}
                disabled={i > stepIndex}
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-all sm:px-3 ${
                  i === stepIndex
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : i < stepIndex
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "text-muted-foreground/50"
                }`}
              >
                <s.icon
                  className={`size-3.5 shrink-0 sm:size-3 ${i === stepIndex && s.key === "scraping" ? "animate-spin" : ""}`}
                />
                <span className={i === stepIndex ? "sm:inline" : "hidden sm:inline"}>
                  {s.label}
                </span>
              </button>
            </div>
          ))}
        </nav>

        {store.step === "url" && <UrlStep />}
        {store.step === "select" && <SelectStep />}
        {store.step === "scraping" && <ScrapingStep />}
        {store.step === "preview" && <PreviewStep router={router} />}
      </div>
    </main>
  );
}

// ─── Step 1: URL ───────────────────────────────────────────

function UrlStep() {
  const {
    url,
    setUrl,
    adapter,
    extensionAvailable,
    isLoading,
    error,
    fetchNovelInfo,
    checkExtension,
  } = useScraperStore();

  const [extId, setExtId] = useState(() => getExtensionId());
  const [timeout, setTimeout_] = useState(() => getScrapeTimeout() / 1000);

  const handleSaveExtId = () => {
    setExtensionId(extId);
    checkExtension();
  };

  const handleTimeoutChange = (val: string) => {
    setTimeout_(parseInt(val, 10) || 0);
  };

  const handleTimeoutBlur = () => {
    const clamped = Math.max(5, Math.min(60, timeout || 10));
    setTimeout_(clamped);
    setScrapeTimeout(clamped * 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nhập URL truyện</CardTitle>
        <CardDescription>
          Dán URL trang truyện để lấy danh sách chương.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Extension config — collapsible when connected */}
        {extensionAvailable ? (
          <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 dark:bg-green-950/20">
            <div className="flex items-center gap-2 text-sm">
              <CircleDotIcon className="size-3.5 text-green-500" />
              <span className="text-green-700 dark:text-green-400">
                Connector đã kết nối
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Timeout:</span>
              <Input
                type="number"
                value={timeout}
                onChange={(e) => handleTimeoutChange(e.target.value)}
                onBlur={handleTimeoutBlur}
                className="h-6 w-14 text-center text-xs"
                min={5}
                max={60}
              />
              <span>s</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ext-id" className="text-xs">
                Extension ID
              </Label>
              <div className="flex gap-2">
                <Input
                  id="ext-id"
                  placeholder="Paste ID từ chrome://extensions"
                  value={extId}
                  onChange={(e) => setExtId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveExtId();
                  }}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveExtId}
                  disabled={!extId.trim()}
                  className="shrink-0"
                >
                  Kết nối
                </Button>
              </div>
            </div>

            {extensionAvailable === null ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderIcon className="size-3 animate-spin" />
                Đang kiểm tra...
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/25 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <XIcon className="size-3" />
                  {!getExtensionId()
                    ? "Chưa nhập Extension ID."
                    : "Không thể kết nối."}
                </div>
                <ol className="list-inside list-decimal space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  <li>Tải extension bên dưới</li>
                  <li>Giải nén file .zip</li>
                  <li>
                    Mở{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                      chrome://extensions
                    </code>
                  </li>
                  <li>
                    Bật <strong>Developer mode</strong> &rarr;{" "}
                    <strong>Load unpacked</strong>
                  </li>
                  <li>Copy ID và dán vào ô trên</li>
                </ol>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  asChild
                >
                  <a href="/novel-studio-connector.zip" download>
                    <DownloadIcon className="mr-1.5 size-3" />
                    Tải Novel Studio Connector
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* URL + Adapter */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="novel-url">URL trang truyện</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="novel-url"
                placeholder="https://sangtacviet.app/truyen/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && adapter && extensionAvailable)
                    fetchNovelInfo();
                }}
              />
              <Button
                onClick={fetchNovelInfo}
                disabled={
                  !url.trim() || !adapter || !extensionAvailable || isLoading
                }
                className="shrink-0"
              >
                {isLoading ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : (
                  "Lấy thông tin"
                )}
              </Button>
            </div>
          </div>

          {/* Adapter selector */}
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs text-muted-foreground">
              Nguồn:
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {getAdapters().map((a) => {
                const autoDetected = url && a.urlPattern.test(url);
                const isSelected = adapter?.name === a.name;
                return (
                  <button
                    key={a.name}
                    onClick={() =>
                      useScraperStore
                        .getState()
                        .setAdapter(isSelected ? null : a)
                    }
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : autoDetected
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-dashed border-muted-foreground/30 text-muted-foreground/60 hover:border-muted-foreground/50 hover:text-muted-foreground"
                    }`}
                  >
                    {isSelected && <CheckIcon className="size-2.5" />}
                    {a.name}
                    {autoDetected && !isSelected && (
                      <span className="text-[9px] opacity-60">auto</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Step 2: Select ────────────────────────────────────────

function SelectStep() {
  const {
    novelInfo,
    selectedChapterUrls,
    toggleChapter,
    selectAll,
    deselectAll,
    startScraping,
    setStep,
  } = useScraperStore();

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  if (!novelInfo) return null;

  const handleSelectRange = () => {
    const from = parseInt(rangeFrom, 10) || 1;
    const to = parseInt(rangeTo, 10) || novelInfo.chapters.length;
    const urls = new Set(
      novelInfo.chapters
        .filter((ch) => ch.order + 1 >= from && ch.order + 1 <= to)
        .map((ch) => ch.url),
    );
    useScraperStore.setState({ selectedChapterUrls: urls });
  };

  const isAllSelected = selectedChapterUrls.size === novelInfo.chapters.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="line-clamp-1">{novelInfo.title}</CardTitle>
        <CardDescription>
          {novelInfo.author && <>{novelInfo.author} · </>}
          {novelInfo.chapters.length} chương ·{" "}
          <span className="font-medium text-foreground">
            {selectedChapterUrls.size}
          </span>{" "}
          đã chọn
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {novelInfo.description && (
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
            {novelInfo.description}
          </p>
        )}

        {/* Controls bar */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={isAllSelected ? deselectAll : selectAll}
          >
            {isAllSelected ? (
              <SquareIcon className="mr-1 size-3" />
            ) : (
              <CheckIcon className="mr-1 size-3" />
            )}
            {isAllSelected ? "Bỏ chọn" : "Chọn tất cả"}
          </Button>

          <div className="mx-1 h-4 w-px bg-border" />

          <div className="flex items-center gap-1">
            <Input
              type="number"
              placeholder="Từ"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="h-7 w-16 text-xs placeholder:text-xs"
              min={1}
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="number"
              placeholder="Đến"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              className="h-7 w-16 text-xs placeholder:text-xs"
              min={1}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSelectRange}
            >
              Chọn
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[340px]">
          <div className="space-y-px pr-4">
            {novelInfo.chapters.map((ch) => (
              <label
                key={ch.url}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-1.5 transition-colors hover:bg-muted/60"
              >
                <Checkbox
                  checked={selectedChapterUrls.has(ch.url)}
                  onCheckedChange={() => toggleChapter(ch.url)}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {ch.title}
                </span>
                <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/50">
                  {ch.order + 1}
                </span>
              </label>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={() => setStep("url")}>
            Quay lại
          </Button>
          <Button
            onClick={startScraping}
            disabled={selectedChapterUrls.size === 0}
          >
            Scrape {selectedChapterUrls.size} chương
            <ArrowRightIcon className="ml-1 size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Progress ──────────────────────────────────────

function ScrapingStep() {
  const { progress, isLoading, error, abortScraping, scrapedChapters } =
    useScraperStore();

  const percent =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  const warnCount = scrapedChapters.filter((ch) => ch.warning).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isLoading && <LoaderIcon className="size-4 animate-spin" />}
          Đang scrape
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span>
            {progress.completed} / {progress.total} chương
          </span>
          {warnCount > 0 && (
            <Badge
              variant="secondary"
              className="gap-1 border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
            >
              <AlertTriangleIcon className="size-2.5" />
              {warnCount}
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Progress value={percent} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate pr-4">{progress.current || "..."}</span>
            <span className="shrink-0 tabular-nums">{percent}%</span>
          </div>
        </div>

        {/* Live chapter results */}
        {scrapedChapters.length > 0 && (
          <ScrollArea className="h-[240px]">
            <div className="space-y-px pr-4">
              {scrapedChapters.map((ch, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${
                    ch.warning
                      ? "bg-amber-50/50 dark:bg-amber-950/10"
                      : ""
                  }`}
                >
                  <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground/40">
                    {i + 1}
                  </span>
                  {ch.warning ? (
                    <AlertTriangleIcon className="size-3 shrink-0 text-amber-500" />
                  ) : (
                    <CheckIcon className="size-3 shrink-0 text-green-500" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {ch.title}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground/40">
                    {ch.content.length.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={abortScraping}>
              Hủy
            </Button>
          </div>
        ) : (
          <div className="flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => useScraperStore.getState().setStep("select")}
            >
              Quay lại
            </Button>
            {scrapedChapters.length > 0 && (
              <Button
                size="sm"
                onClick={() => useScraperStore.getState().setStep("preview")}
              >
                Xem trước {scrapedChapters.length} chương đã scrape
                <ArrowRightIcon className="ml-1 size-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Step 4: Preview ───────────────────────────────────────

function PreviewStep({ router }: { router: ReturnType<typeof useRouter> }) {
  const { novelInfo, scrapedChapters, url, reset } = useScraperStore();
  const novels = useNovels();

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [selectedNovelId, setSelectedNovelId] = useState<string>("");
  const [novelTitle, setNovelTitle] = useState(novelInfo?.title ?? "");
  const [novelDescription, setNovelDescription] = useState(
    novelInfo?.description ?? "",
  );
  const [isImporting, setIsImporting] = useState(false);

  const totalWords = scrapedChapters.reduce(
    (sum, ch) => sum + countWords(stripHtml(ch.content)),
    0,
  );
  const warnCount = scrapedChapters.filter((ch) => ch.warning).length;

  const handleImport = async () => {
    if (mode === "new" && !novelTitle.trim()) {
      toast.error("Vui lòng nhập tiêu đề tiểu thuyết");
      return;
    }
    if (mode === "existing" && !selectedNovelId) {
      toast.error("Vui lòng chọn truyện");
      return;
    }

    setIsImporting(true);
    try {
      const now = new Date();

      if (mode === "new") {
        const novelId = crypto.randomUUID();
        await db.transaction(
          "rw",
          [db.novels, db.chapters, db.scenes],
          async () => {
            await db.novels.add({
              id: novelId,
              title: novelTitle.trim(),
              description: novelDescription.trim(),
              sourceUrl: url,
              author: novelInfo?.author,
              createdAt: now,
              updatedAt: now,
            });
            await insertChapters(novelId, 0, now);
          },
        );
        toast.success(
          `Đã tạo "${novelTitle}" với ${scrapedChapters.length} chương`,
        );
        reset();
        router.push(`/novels/${novelId}`);
      } else {
        const existingChapters = await db.chapters
          .where("novelId")
          .equals(selectedNovelId)
          .sortBy("order");
        const startOrder =
          existingChapters.length > 0
            ? Math.max(...existingChapters.map((c) => c.order)) + 1
            : 0;

        await db.transaction(
          "rw",
          [db.novels, db.chapters, db.scenes],
          async () => {
            await db.novels.update(selectedNovelId, {
              sourceUrl: url,
              updatedAt: now,
            });
            await insertChapters(selectedNovelId, startOrder, now);
          },
        );
        const novelName =
          novels?.find((n) => n.id === selectedNovelId)?.title ?? "truyện";
        toast.success(
          `Đã thêm ${scrapedChapters.length} chương vào "${novelName}"`,
        );
        reset();
        router.push(`/novels/${selectedNovelId}`);
      }
    } catch (error) {
      toast.error(
        `Nhập thất bại: ${error instanceof Error ? error.message : "Lỗi không xác định"}`,
      );
    } finally {
      setIsImporting(false);
    }
  };

  const insertChapters = async (
    novelId: string,
    startOrder: number,
    now: Date,
  ) => {
    for (let i = 0; i < scrapedChapters.length; i++) {
      const ch = scrapedChapters[i];
      const chapterId = crypto.randomUUID();
      const plainText = stripHtml(ch.content);

      await db.chapters.add({
        id: chapterId,
        novelId,
        title: ch.title,
        order: startOrder + i,
        createdAt: now,
        updatedAt: now,
      });

      await db.scenes.add({
        id: crypto.randomUUID(),
        chapterId,
        novelId,
        title: ch.title,
        content: ch.content,
        order: 0,
        wordCount: countWords(plainText),
        version: 0,
        versionType: "manual",
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Xem trước & Nhập</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span>
            {scrapedChapters.length} chương · {totalWords.toLocaleString()} từ
          </span>
          {warnCount > 0 && (
            <Badge
              variant="secondary"
              className="gap-1 border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
            >
              <AlertTriangleIcon className="size-3" />
              {warnCount} cảnh báo
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode tabs */}
        <div className="flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setMode("new")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "new"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PlusIcon className="size-3.5" />
            Tạo truyện mới
          </button>
          <button
            onClick={() => setMode("existing")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "existing"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookPlusIcon className="size-3.5" />
            Thêm vào truyện có sẵn
          </button>
        </div>

        {mode === "new" ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="novel-title" className="text-xs">
                Tiêu đề
              </Label>
              <Input
                id="novel-title"
                value={novelTitle}
                onChange={(e) => setNovelTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="novel-desc" className="text-xs">
                Mô tả
              </Label>
              <Textarea
                id="novel-desc"
                value={novelDescription}
                onChange={(e) => setNovelDescription(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
        ) : (
          <div>
            <Label className="text-xs">Chọn truyện</Label>
            <Select value={selectedNovelId} onValueChange={setSelectedNovelId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn truyện để thêm chương..." />
              </SelectTrigger>
              <SelectContent>
                {novels?.map((novel) => (
                  <SelectItem key={novel.id} value={novel.id}>
                    <div className="flex items-center gap-2">
                      <LibraryIcon className="size-3 text-muted-foreground" />
                      {novel.title}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Chapter list */}
        <ScrollArea className="h-[280px]">
          <div className="space-y-1 pr-4">
            {scrapedChapters.map((ch, i) => {
              const plainText = stripHtml(ch.content);
              const words = countWords(plainText);
              return (
                <div
                  key={i}
                  className={`group flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-muted/40 ${
                    ch.warning ? "bg-amber-50/50 dark:bg-amber-950/10" : ""
                  }`}
                >
                  <span className="mt-px w-6 shrink-0 text-right tabular-nums text-[10px] text-muted-foreground/40">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-medium">
                      {ch.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {plainText.slice(0, 120)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/50">
                        {words.toLocaleString()} từ
                      </span>
                      {ch.warning && (
                        <>
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                            <AlertTriangleIcon className="size-2.5" />
                            Nội dung ngắn
                          </span>
                          <button
                            onClick={() =>
                              useScraperStore.getState().retryScrapeChapter(i)
                            }
                            className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                          >
                            <RefreshCwIcon className="size-2.5" />
                            Thử lại
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => useScraperStore.getState().setStep("select")}
          >
            Quay lại
          </Button>
          <Button onClick={handleImport} disabled={isImporting}>
            {isImporting ? (
              <>
                <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
                Đang nhập...
              </>
            ) : mode === "new" ? (
              "Tạo & nhập truyện"
            ) : (
              "Thêm vào truyện"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Debug Toolbar (compact icon strip) ────────────────────

function DebugToolbar() {
  const { debugLogs, clearDebugLogs } = useScraperStore();
  const [open, setOpen] = useState(false);

  const logCount = debugLogs.length;

  const copyAll = () => {
    const text = debugLogs
      .map((log) => `[${log.timestamp}] ${log.label}\n${log.data}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Đã copy debug logs");
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">
        {logCount > 0 && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setOpen(!open)}
                  className={`relative flex size-7 items-center justify-center rounded-md transition-colors ${
                    open
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <TerminalIcon className="size-3.5" />
                  <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                    {logCount > 9 ? "9+" : logCount}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Debug logs</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={copyAll}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ClipboardCopyIcon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy tất cả logs</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    clearDebugLogs();
                    setOpen(false);
                  }}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Xóa logs</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Floating debug panel */}
      {open && logCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl px-6">
            <div className="flex items-center justify-between py-2">
              <span className="text-xs font-medium text-muted-foreground">
                Debug Logs ({logCount})
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
            <ScrollArea className="h-[240px] pb-3">
              <div className="space-y-2">
                {debugLogs.map((log, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] tabular-nums text-muted-foreground/50">
                        {log.timestamp}
                      </span>
                      <span className="text-[11px] font-medium">
                        {log.label}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(log.data);
                          toast.success(`Copied`);
                        }}
                        className="ml-auto text-[10px] text-muted-foreground/40 hover:text-foreground"
                      >
                        copy
                      </button>
                    </div>
                    <pre className="mt-0.5 max-h-[140px] overflow-auto rounded bg-muted/60 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {log.data}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
