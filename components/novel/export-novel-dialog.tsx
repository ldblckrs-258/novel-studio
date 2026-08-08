"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DEFAULT_EXPORT_SELECTION,
  downloadNovelJson,
  downloadNovelTxt,
  exportNovel,
  exportNovelTxt,
  type ExportSelection,
} from "@/lib/novel-io";
import { useState } from "react";
import { toast } from "sonner";

const GROUPS: {
  key: keyof Omit<ExportSelection, "includeVersions">;
  label: string;
  description: string;
}[] = [
  {
    key: "chapters",
    label: "Chương & cảnh",
    description: "Nội dung chương và các cảnh hiện hành.",
  },
  {
    key: "characters",
    label: "Nhân vật",
    description: "Danh sách nhân vật của truyện.",
  },
  {
    key: "notes",
    label: "Ghi chú",
    description: "Các ghi chú gắn với truyện.",
  },
  {
    key: "worldbuilding",
    label: "Thông tin thế giới & phân tích",
    description: "Thể loại, tóm tắt, thế giới, phe phái, kết quả phân tích.",
  },
  {
    key: "qtAndState",
    label: "Dữ liệu QT & trạng thái truyện",
    description:
      "Bảng tên, luật thay thế, tên loại trừ và trạng thái mạch truyện.",
  },
];

export function ExportNovelDialog({
  novel,
  open,
  onOpenChange,
}: {
  novel: { id: string; title: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [format, setFormat] = useState<"json" | "txt">("json");
  const [selection, setSelection] = useState<ExportSelection>(
    DEFAULT_EXPORT_SELECTION,
  );
  const [isExporting, setIsExporting] = useState(false);

  const toggle = (key: keyof ExportSelection) =>
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));

  const nothingSelected = format === "json" && GROUPS.every((g) => !selection[g.key]);

  const handleExport = async () => {
    if (!novel) return;
    setIsExporting(true);
    try {
      if (format === "txt") {
        const text = await exportNovelTxt(novel.id);
        if (!text.trim()) {
          toast.error("Truyện chưa có nội dung chương để xuất.");
          return;
        }
        downloadNovelTxt(novel.title, text);
      } else {
        const data = await exportNovel(novel.id, selection);
        downloadNovelJson(data);
      }
      toast.success(`Đã xuất "${novel.title}"`);
      onOpenChange(false);
    } catch {
      toast.error("Xuất tiểu thuyết thất bại.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xuất tiểu thuyết</DialogTitle>
          <DialogDescription>
            Chọn định dạng và dữ liệu muốn xuất.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={format}
          onValueChange={(value) => setFormat(value as "json" | "txt")}
          className="gap-3"
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="json" id="format-json" className="mt-0.5" />
            <div className="grid gap-0.5">
              <Label htmlFor="format-json" className="font-medium">
                JSON
              </Label>
              <span className="text-xs text-muted-foreground">
                Tệp đầy đủ, có thể nhập lại vào Novel Studio.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="txt" id="format-txt" className="mt-0.5" />
            <div className="grid gap-0.5">
              <Label htmlFor="format-txt" className="font-medium">
                Văn bản (.txt)
              </Label>
              <span className="text-xs text-muted-foreground">
                Chỉ nội dung chương, nối theo thứ tự đọc.
              </span>
            </div>
          </div>
        </RadioGroup>

        <div className={format === "json" ? "space-y-3" : "hidden"}>
          {GROUPS.map((g) => (
            <div key={g.key}>
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`export-${g.key}`}
                  checked={selection[g.key]}
                  onCheckedChange={() => toggle(g.key)}
                  className="mt-0.5"
                />
                <div className="grid gap-0.5">
                  <Label htmlFor={`export-${g.key}`} className="font-medium">
                    {g.label}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {g.description}
                  </span>
                </div>
              </div>
              {g.key === "chapters" && selection.chapters && (
                <div className="ml-7 mt-2 flex items-center gap-3">
                  <Checkbox
                    id="export-versions"
                    checked={selection.includeVersions}
                    onCheckedChange={() => toggle("includeVersions")}
                  />
                  <Label
                    htmlFor="export-versions"
                    className="text-sm font-normal"
                  >
                    Bao gồm lịch sử phiên bản cảnh
                  </Label>
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || nothingSelected}
          >
            {isExporting
              ? "Đang xuất..."
              : format === "txt"
                ? "Xuất TXT"
                : "Xuất JSON"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
