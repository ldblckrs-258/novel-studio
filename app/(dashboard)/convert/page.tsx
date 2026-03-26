"use client";

import { Button } from "@/components/ui/button";
import { ConvertConfig } from "@/components/convert-config";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useConvertSettings } from "@/lib/hooks/use-convert-settings";
import { convertText, useQTEngineReady } from "@/lib/hooks/use-qt-engine";
import {
  ArrowRightLeftIcon,
  CheckIcon,
  ClipboardCopyIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export default function ConvertPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied] = useState(false);
  const engineReady = useQTEngineReady();
  const convertOptions = useConvertSettings();

  const handleConvert = useCallback(async () => {
    if (!input.trim()) return;
    setIsConverting(true);
    try {
      const result = await convertText(input, { options: convertOptions });
      setOutput(result.plainText);
    } catch (err) {
      toast.error(
        "Lỗi convert: " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setIsConverting(false);
    }
  }, [input, convertOptions]);

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
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">Convert nhanh</h1>
          <p className="text-muted-foreground text-sm">
            Dán văn bản tiếng Trung và convert sang tiếng Việt bằng từ điển QT.
            Không cần API key.
          </p>
        </div>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Input */}
        <div className="space-y-2">
          <div className="flex h-8 items-center justify-between">
            <label className="text-sm font-medium">Văn bản gốc (Trung)</label>
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
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Dán văn bản tiếng Trung vào đây..."
            className="h-[calc(100vh-280px)] resize-none font-mono text-sm"
          />
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex h-8 items-center justify-between">
            <label className="text-sm font-medium">Kết quả (Việt)</label>
            {output && (
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? (
                  <CheckIcon className="mr-1.5 size-3.5" />
                ) : (
                  <ClipboardCopyIcon className="mr-1.5 size-3.5" />
                )}
                {copied ? "Đã sao chép" : "Sao chép"}
              </Button>
            )}
          </div>
          <Textarea
            value={output}
            readOnly
            placeholder="Kết quả convert sẽ hiển thị ở đây..."
            className="bg-muted/30 h-[calc(100vh-280px)] resize-none font-mono text-sm"
          />
        </div>
      </div>

      {/* Convert button */}
      <div className="mt-4 flex justify-center">
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
    </main>
  );
}
