"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Character, PlotArc } from "@/lib/db";
import { useCharacters, usePlotArcs } from "@/lib/hooks";
import { useWritingPipelineStore } from "@/lib/stores/writing-pipeline";
import { cn } from "@/lib/utils";
import { MapIcon, UsersIcon } from "lucide-react";

export function DirectionPreFilter({ novelId }: { novelId: string }) {
  const characters = useCharacters(novelId);
  const plotArcs = usePlotArcs(novelId);
  const activeArcs = plotArcs?.filter((a) => a.status === "active") ?? [];

  const selectedArcIds = useWritingPipelineStore((s) => s.directionArcIds);
  const selectedCharIds = useWritingPipelineStore(
    (s) => s.directionCharacterIds,
  );
  const setArcIds = useWritingPipelineStore((s) => s.setDirectionArcIds);
  const setCharIds = useWritingPipelineStore((s) => s.setDirectionCharacterIds);

  const toggleArc = (id: string) => {
    setArcIds(
      selectedArcIds.includes(id)
        ? selectedArcIds.filter((x) => x !== id)
        : [...selectedArcIds, id],
    );
  };

  const toggleChar = (id: string) => {
    setCharIds(
      selectedCharIds.includes(id)
        ? selectedCharIds.filter((x) => x !== id)
        : [...selectedCharIds, id],
    );
  };

  const ARC_TYPE_COLOR: Record<string, string> = {
    main: "text-red-600 dark:text-red-400",
    subplot: "text-amber-600 dark:text-amber-400",
    character: "text-violet-600 dark:text-violet-400",
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">Lọc nội dung cho chương</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Chọn mạch truyện và nhân vật cần tập trung. Để trống = dùng tất cả.
        </p>
      </div>

      {/* Arcs */}
      {activeArcs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <MapIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs font-medium">
              Mạch truyện ({selectedArcIds.length || "tất cả"})
            </Label>
          </div>
          <ScrollArea className="h-[160px]">
            <div className="space-y-1 pr-3">
              {activeArcs.map((arc) => (
                <ArcItem
                  key={arc.id}
                  arc={arc}
                  checked={selectedArcIds.includes(arc.id)}
                  onToggle={() => toggleArc(arc.id)}
                  typeColor={ARC_TYPE_COLOR[arc.type] ?? ""}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Characters */}
      {characters && characters.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs font-medium">
              Nhân vật ({selectedCharIds.length || "tất cả"})
            </Label>
          </div>
          <ScrollArea className="h-[120px]">
            <div className="flex flex-wrap gap-1.5 pr-3">
              {characters.map((c) => (
                <CharacterChip
                  key={c.id}
                  character={c}
                  checked={selectedCharIds.includes(c.id)}
                  onToggle={() => toggleChar(c.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function ArcItem({
  arc,
  checked,
  onToggle,
  typeColor,
}: {
  arc: PlotArc;
  checked: boolean;
  onToggle: () => void;
  typeColor: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors overflow-hidden",
        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate min-w-0">{arc.title}</span>
          <Badge variant="secondary" className={cn("text-[10px] shrink-0", typeColor)}>
            {arc.type}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {arc.description}
        </p>
      </div>
    </label>
  );
}

function CharacterChip({
  character,
  checked,
  onToggle,
}: {
  character: Character;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors max-w-full",
        checked
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          checked ? "bg-primary" : "bg-muted-foreground/40",
        )}
      />
      <span className="truncate">{character.name}</span>
      <span className="text-[10px] opacity-60 shrink-0">({character.role})</span>
    </button>
  );
}
