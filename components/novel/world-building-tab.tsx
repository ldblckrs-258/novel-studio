"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { NameDescription, Novel } from "@/lib/db";
import { updateNovel } from "@/lib/hooks";
import {
  CpuIcon,
  GlobeIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  ScrollTextIcon,
  ShieldIcon,
  SwordsIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";
import { EditableText } from "./editable-text";
import { FactionEditDialog } from "./faction-edit-dialog";

function ItemList({
  items,
  type,
  onUpdate,
}: {
  items: NameDescription[];
  type: "faction" | "location";
  onUpdate: (items: NameDescription[]) => void;
}) {
  const [editItem, setEditItem] = useState<NameDescription | undefined>();
  const [editIndex, setEditIndex] = useState(-1);
  const [addOpen, setAddOpen] = useState(false);

  const label = type === "faction" ? "Phe phái" : "Địa điểm";
  const Icon = type === "faction" ? ShieldIcon : MapPinIcon;

  return (
    <>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon className="size-3.5" />
            {label}
          </p>
          <Button variant="outline" size="xs" onClick={() => setAddOpen(true)}>
            <PlusIcon className="size-3" />
            Thêm
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">Chưa có</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div
                key={`${item.name}-${i}`}
                className="flex items-start gap-2 rounded-md border p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{item.name}</span>
                  {item.description && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {item.description}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setEditItem(item);
                    setEditIndex(i);
                  }}
                >
                  <PencilIcon className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onUpdate(items.filter((_, j) => j !== i))}
                >
                  <TrashIcon className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <FactionEditDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        type={type}
        onSave={(item) => onUpdate([...items, item])}
      />

      {editItem && (
        <FactionEditDialog
          open={editIndex >= 0}
          onOpenChange={(open) => {
            if (!open) {
              setEditItem(undefined);
              setEditIndex(-1);
            }
          }}
          type={type}
          item={editItem}
          onSave={(updated) => {
            onUpdate(items.map((it, i) => (i === editIndex ? updated : it)));
            setEditItem(undefined);
            setEditIndex(-1);
          }}
        />
      )}
    </>
  );
}

export function WorldBuildingTab({
  novel,
}: {
  novel: Novel;
}) {
  const save = (field: string, value: unknown) => {
    updateNovel(novel.id, { [field]: value });
  };

  const section = (
    icon: React.ElementType,
    label: string,
    field: keyof Novel,
    multi = true,
  ) => {
    const Icon = icon;
    return (
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </p>
        <EditableText
          value={
            (typeof novel[field] === "string" ? novel[field] : "") ?? ""
          }
          onSave={(v) => save(field, v || undefined)}
          placeholder={`Chưa có ${label.toLowerCase()}...`}
          multiline={multi}
          displayClassName="text-sm leading-relaxed"
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {section(GlobeIcon, "Tổng quan thế giới", "worldOverview")}
      <Separator />
      {section(MapPinIcon, "Bối cảnh câu chuyện", "storySetting")}
      {section(GlobeIcon, "Thời kỳ", "timePeriod", false)}
      <Separator />
      {section(SwordsIcon, "Hệ thống sức mạnh", "powerSystem")}
      <Separator />
      <ItemList
        items={novel.factions ?? []}
        type="faction"
        onUpdate={(v) => save("factions", v)}
      />
      <Separator />
      <ItemList
        items={novel.keyLocations ?? []}
        type="location"
        onUpdate={(v) => save("keyLocations", v)}
      />
      <Separator />
      {section(ScrollTextIcon, "Quy luật thế giới", "worldRules")}
      {section(CpuIcon, "Trình độ công nghệ", "technologyLevel", false)}
    </div>
  );
}
