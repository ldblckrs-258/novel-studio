"use client";

import { ConvertConfig } from "@/components/convert-config";
import { ConvertDetectedNames } from "@/components/convert-detected-names";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { TextCompareEditor } from "@/components/ui/text-compare-editor";
import { useConvertSettings } from "@/lib/hooks/use-convert-settings";
import { useDebouncedValue } from "@/lib/hooks/use-debounce";
import { useExcludedNamesList } from "@/lib/hooks/use-excluded-names";
import { convertText, useQTEngineReady } from "@/lib/hooks/use-qt-engine";
import type { ConvertOptions, DictPair } from "@/lib/workers/qt-engine.types";
import { useReaderPanel } from "@/lib/stores/reader-panel";
import {
  ArrowRightLeftIcon,
  CheckIcon,
  ClipboardCopyIcon,
  LoaderIcon,
  SettingsIcon,
  Trash2Icon,
  Volume2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export default function ConvertPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [detectedNames, setDetectedNames] = useState<DictPair[]>([]);
  const engineReady = useQTEngineReady();
  const convertOptions = useConvertSettings();
  const rejectedAutoNames = useExcludedNamesList();
  const debouncedInput = useDebouncedValue(input, 500);
  const seqRef = useRef(0);

  // Merge persistent settings with ephemeral rejected names
  const mergedOptions = useMemo<ConvertOptions>(
    () => ({ ...convertOptions, rejectedAutoNames }),
    [convertOptions, rejectedAutoNames],
  );

  const handleConvert = useCallback(async () => {
    if (!input.trim()) return;
    const seq = ++seqRef.current;
    setIsConverting(true);
    try {
      const result = await convertText(input, { options: mergedOptions });
      if (seqRef.current === seq) {
        setOutput(result.plainText);
        setDetectedNames(result.detectedNames ?? []);
      }
    } catch (err) {
      toast.error(
        "Lỗi convert: " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      if (seqRef.current === seq) setIsConverting(false);
    }
  }, [input, mergedOptions]);

  useEffect(() => {
    if (!liveMode || !engineReady) return;
    if (!debouncedInput.trim()) {
      setOutput("");
      return;
    }
    const seq = ++seqRef.current;
    setIsConverting(true);
    convertText(debouncedInput, { options: mergedOptions })
      .then((result) => {
        if (seqRef.current === seq) {
          setOutput(result.plainText);
          setDetectedNames(result.detectedNames ?? []);
        }
      })
      .catch((err) => {
        if (seqRef.current === seq)
          toast.error(
            "Lỗi convert: " +
              (err instanceof Error ? err.message : String(err)),
          );
      })
      .finally(() => {
        if (seqRef.current === seq) setIsConverting(false);
      });
  }, [liveMode, debouncedInput, mergedOptions, engineReady]);

  const handleRead = useCallback(() => {
    if (!output.trim()) return;
    useReaderPanel.getState().loadText(output, "Kết quả convert");
  }, [output]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Đã sao chép");
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setDetectedNames([]);
  }, []);

  return (
    <main className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden px-6 py-4">
      {/* ── Header ── */}
      <div className="mb-4 flex shrink-0 items-start justify-between flex-col sm:flex-row gap-2">
        <div>
          <h1 className="font-serif text-2xl font-bold">Convert nhanh</h1>
          <p className="text-sm text-muted-foreground">
            Dán văn bản tiếng Trung và convert sang tiếng Việt bằng từ điển QT.
            Không cần API key.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {input && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClear}
              title="Xóa"
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          )}
          {output && (
            <>
              <Button variant="ghost" size="sm" onClick={handleRead}>
                <Volume2Icon className="mr-1.5 size-3.5" />
                Đọc
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? (
                  <CheckIcon className="mr-1.5 size-3.5" />
                ) : (
                  <ClipboardCopyIcon className="mr-1.5 size-3.5" />
                )}
                {copied ? "Đã chép" : "Sao chép"}
              </Button>
            </>
          )}

          {(input || output) && <div className="h-5 w-px bg-border" />}

          <div className="flex items-center gap-2">
            <Switch
              id="live-mode"
              checked={liveMode}
              onCheckedChange={setLiveMode}
              disabled={!engineReady}
            />
            <Label htmlFor="live-mode" className="text-sm">
              Live
            </Label>
          </div>

          {isConverting && (
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <SettingsIcon className="mr-1.5 size-3.5" />
                Cài đặt
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <ConvertConfig />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── Side-by-side editor ── */}
      <TextCompareEditor
        panelWrapperClassName="h-[calc(100dvh-260px)]"
        leftValue={input}
        rightValue={output}
        onChange={setInput}
        editableSide="left"
        storageKey="convert"
        leftLabel="Văn bản gốc (Trung)"
        rightLabel="Kết quả (Việt)"
      />

      {/* ── Detected names ── */}
      {detectedNames.length > 0 && (
        <div className="mt-3 shrink-0">
          <ConvertDetectedNames detectedNames={detectedNames} />
        </div>
      )}

      {/* ── Manual convert button ── */}
      {!liveMode && (
        <div className="mt-4 flex shrink-0 justify-center">
          <Button
            size="lg"
            onClick={handleConvert}
            disabled={isConverting || !input.trim() || !engineReady}
          >
            <ArrowRightLeftIcon className="mr-2 size-4" />
            {isConverting
              ? "Đang convert..."
              : !engineReady
                ? "Đang tải từ điển..."
                : "Convert"}
          </Button>
        </div>
      )}
    </main>
  );
}
