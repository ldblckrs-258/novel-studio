"use client";

import { useCallback, useState } from "react";
import {
  BrainIcon,
  CheckIcon,
  LoaderIcon,
  RulerIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
// Input unused but kept for potential future inline editing
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { db } from "@/lib/db";
import {
  extractNamesAI,
  extractNamesRuleBased,
  type ExtractedName,
} from "@/lib/chapter-tools/name-extract";
import { bulkCreateNameEntries } from "@/lib/hooks/use-name-entries";
import { useAnalysisSettings, useChatSettings, useAIProvider } from "@/lib/hooks";
import { resolveChapterToolModel } from "@/lib/chapter-tools/stream-runner";

export function NameExtractDialog({
  open,
  onOpenChange,
  novelId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
}) {
  const [mode, setMode] = useState<"ai" | "rule">("rule");
  const [isExtracting, setIsExtracting] = useState(false);
  const [results, setResults] = useState<ExtractedName[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetScope, setTargetScope] = useState<"novel" | "global">("novel");

  const settings = useAnalysisSettings();
  const chatSettings = useChatSettings();
  const provider = useAIProvider(chatSettings?.providerId);

  const handleExtract = useCallback(async () => {
    setIsExtracting(true);
    setResults([]);
    setSelected(new Set());

    try {
      // Get all active scenes for this novel
      const scenes = await db.scenes
        .where("[novelId+isActive]")
        .equals([novelId, 1])
        .toArray();
      const sourceText = scenes.map((s) => s.content).join("\n");

      if (!sourceText.trim()) {
        toast.error("Không có nội dung để phân tích");
        setIsExtracting(false);
        return;
      }

      if (mode === "ai") {
        const model = await resolveChapterToolModel(
          settings?.translateModel,
          provider,
          chatSettings,
        );
        if (!model) {
          toast.error("Vui lòng cấu hình nhà cung cấp AI");
          setIsExtracting(false);
          return;
        }
        const names = await extractNamesAI({
          model,
          sourceText: sourceText.slice(0, 10000),
          translatedText: "", // No translated text available in this context
        });
        setResults(names);
      } else {
        // Rule-based: get phienAm map from dict entries
        const phienAmEntries = await db.dictEntries
          .where("source")
          .equals("phienam")
          .toArray();
        const phienAmMap = new Map(
          phienAmEntries.map((e) => [e.chinese, e.vietnamese]),
        );
        const names = await extractNamesRuleBased({
          sourceText,
          phienAmMap,
        });
        setResults(names);
      }

      toast.success("Đã trích xuất xong");
    } catch (err) {
      toast.error(
        "Lỗi trích xuất: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setIsExtracting(false);
    }
  }, [mode, novelId, settings, provider, chatSettings]);

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i)));
    }
  };

  const handleAddToDict = async () => {
    const entries = results
      .filter((_, i) => selected.has(i))
      .map((e) => ({
        scope: targetScope === "novel" ? novelId : "global",
        chinese: e.chinese,
        vietnamese: e.vietnamese,
        category: e.category,
      }));

    if (!entries.length) return;
    await bulkCreateNameEntries(entries);
    toast.success(`Đã thêm ${entries.length} mục vào từ điển`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trích xuất tên</DialogTitle>
          <DialogDescription>
            Tự động tìm tên nhân vật, địa danh từ nội dung tiểu thuyết
          </DialogDescription>
        </DialogHeader>

        {/* Config */}
        {results.length === 0 && !isExtracting && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phương pháp</Label>
              <div className="flex gap-2">
                <Button
                  variant={mode === "rule" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("rule")}
                >
                  <RulerIcon className="mr-1.5 size-3.5" />
                  Quy tắc (miễn phí)
                </Button>
                <Button
                  variant={mode === "ai" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("ai")}
                >
                  <BrainIcon className="mr-1.5 size-3.5" />
                  AI (tốn token)
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                {mode === "rule"
                  ? "Tìm chuỗi 2-4 ký tự Trung có họ phổ biến, xuất hiện ≥3 lần. Nhanh, miễn phí nhưng kém chính xác."
                  : "Dùng AI phân tích cặp (gốc, dịch) để trích xuất tên. Chính xác hơn nhưng tốn token."}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isExtracting && (
          <div className="flex items-center justify-center py-12">
            <LoaderIcon className="size-6 animate-spin" />
            <span className="ml-2 text-sm">Đang phân tích...</span>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && !isExtracting && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {results.length} kết quả, {selected.size} đã chọn
              </span>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selected.size === results.length
                  ? "Bỏ chọn tất cả"
                  : "Chọn tất cả"}
              </Button>
            </div>

            <ScrollArea className="h-72">
              <div className="space-y-1">
                {results.map((name, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selected.has(idx)}
                      onCheckedChange={() => toggleSelect(idx)}
                    />
                    <span className="w-20 truncate font-mono font-semibold">
                      {name.chinese}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="flex-1 truncate">{name.vietnamese}</span>
                    <Badge variant="outline" className="text-xs">
                      {name.category}
                    </Badge>
                    <span className="text-muted-foreground w-8 text-right text-xs">
                      {Math.round(name.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center gap-2">
              <Label className="text-xs">Thêm vào:</Label>
              <Select
                value={targetScope}
                onValueChange={(v) =>
                  setTargetScope(v as "novel" | "global")
                }
              >
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novel">Từ điển tiểu thuyết</SelectItem>
                  <SelectItem value="global">Từ điển chung</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {results.length === 0 && !isExtracting && (
            <Button onClick={handleExtract}>
              <SearchIcon className="mr-2 size-4" />
              Trích xuất
            </Button>
          )}
          {results.length > 0 && !isExtracting && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResults([]);
                  setSelected(new Set());
                }}
              >
                Trích xuất lại
              </Button>
              <Button
                onClick={handleAddToDict}
                disabled={selected.size === 0}
              >
                <CheckIcon className="mr-2 size-3.5" />
                Thêm {selected.size} mục
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
