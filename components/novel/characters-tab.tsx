"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import type { Character } from "@/lib/db";
import { deleteCharacter } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  CrosshairIcon,
  HeartIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  RouteIcon,
  ShieldIcon,
  SparklesIcon,
  SwordsIcon,
  TargetIcon,
  TrashIcon,
  UserIcon,
  ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CharacterEditDialog } from "./character-edit-dialog";

// ─── Detail row with icon + color ───────────────────────────

const DETAIL_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  appearance: {
    icon: SparklesIcon,
    color: "text-pink-500 dark:text-pink-400",
  },
  personality: {
    icon: HeartIcon,
    color: "text-rose-500 dark:text-rose-400",
  },
  hobbies: {
    icon: ZapIcon,
    color: "text-amber-500 dark:text-amber-400",
  },
  relationshipWithMC: {
    icon: LinkIcon,
    color: "text-blue-500 dark:text-blue-400",
  },
  characterArc: {
    icon: RouteIcon,
    color: "text-emerald-500 dark:text-emerald-400",
  },
  strengths: {
    icon: ShieldIcon,
    color: "text-green-500 dark:text-green-400",
  },
  weaknesses: {
    icon: SwordsIcon,
    color: "text-red-500 dark:text-red-400",
  },
  motivations: {
    icon: CrosshairIcon,
    color: "text-violet-500 dark:text-violet-400",
  },
  goals: {
    icon: TargetIcon,
    color: "text-cyan-500 dark:text-cyan-400",
  },
};

function DetailRow({
  field,
  label,
  value,
}: {
  field: string;
  label: string;
  value?: string;
}) {
  if (!value || value === "Unknown" || value === "N/A") return null;
  const config = DETAIL_CONFIG[field];
  const Icon = config?.icon ?? ZapIcon;
  const color = config?.color ?? "text-muted-foreground";

  return (
    <div className="flex gap-2.5">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", color)} />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
        <p className="text-xs leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

// ─── Character card ─────────────────────────────────────────

function CharacterCard({
  char,
  onEdit,
  onDelete,
}: {
  char: Character;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const hasDetails =
    char.appearance ||
    char.personality ||
    char.hobbies ||
    char.relationshipWithMC ||
    char.characterArc ||
    char.strengths ||
    char.weaknesses ||
    char.motivations ||
    char.goals ||
    (char.relationships && char.relationships.length > 0);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-2.5">
            {/* Avatar placeholder with initial */}
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-sm font-bold text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
              {char.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">{char.name}</CardTitle>
                {hasDetails && (
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon-xs" className="shrink-0">
                      <ChevronDownIcon
                        className={cn(
                          "size-3.5 transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                )}
              </div>
              {(char.role || char.age || char.sex) && (
                <CardDescription className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {char.role && (
                    <Badge variant="outline" className="text-[10px]">
                      {char.role}
                    </Badge>
                  )}
                  {char.sex && char.sex !== "Unknown" && (
                    <span className="text-[11px]">{char.sex}</span>
                  )}
                  {char.age && char.age !== "Unknown" && (
                    <span className="text-[11px] text-muted-foreground/60">
                      {char.age}
                    </span>
                  )}
                </CardDescription>
              )}
            </div>
          </div>
          <CardAction>
            <div className="flex gap-0.5">
              <Button variant="ghost" size="icon-xs" onClick={onEdit}>
                <PencilIcon className="size-3" />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={onDelete}>
                <TrashIcon className="size-3" />
              </Button>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="pt-0">
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {char.description || "Chưa có mô tả"}
          </p>

          <CollapsibleContent>
            <Separator className="my-3" />
            <div className="space-y-3">
              <DetailRow
                field="appearance"
                label="Ngoại hình"
                value={char.appearance}
              />
              <DetailRow
                field="personality"
                label="Tính cách"
                value={char.personality}
              />
              <DetailRow
                field="hobbies"
                label="Sở thích"
                value={char.hobbies}
              />
              <DetailRow
                field="relationshipWithMC"
                label="Quan hệ với nhân vật chính"
                value={char.relationshipWithMC}
              />
              {char.relationships && char.relationships.length > 0 && (
                <div className="flex gap-2.5">
                  <LinkIcon className="mt-0.5 size-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Mối quan hệ
                    </p>
                    <div className="mt-1 space-y-1">
                      {char.relationships.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-baseline gap-1.5 text-xs"
                        >
                          <span className="font-medium">{r.characterName}</span>
                          <span className="text-muted-foreground/70">—</span>
                          <span className="text-muted-foreground">
                            {r.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <DetailRow
                field="characterArc"
                label="Hành trình nhân vật"
                value={char.characterArc}
              />
              <DetailRow
                field="strengths"
                label="Điểm mạnh"
                value={char.strengths}
              />
              <DetailRow
                field="weaknesses"
                label="Điểm yếu"
                value={char.weaknesses}
              />
              <DetailRow
                field="motivations"
                label="Động lực"
                value={char.motivations}
              />
              <DetailRow field="goals" label="Mục tiêu" value={char.goals} />
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

// ─── Characters tab ─────────────────────────────────────────

export function CharactersTab({
  characters,
  novelId,
}: {
  characters: Character[];
  novelId: string;
}) {
  const [editChar, setEditChar] = useState<Character | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCharacter(deleteTarget.id);
      toast.success(`Đã xóa ${deleteTarget.name}`);
    } catch {
      toast.error("Xóa thất bại");
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserIcon className="size-4 text-violet-500" />
          <span className="text-sm text-muted-foreground">
            {characters.length} nhân vật
          </span>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PlusIcon className="mr-1.5 size-3.5" />
          Thêm nhân vật
        </Button>
      </div>

      {characters.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12">
          <UserIcon className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Chưa có nhân vật</p>
          <p className="text-xs text-muted-foreground/60">
            Thêm thủ công hoặc chạy phân tích AI
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {characters.map((char) => (
            <CharacterCard
              key={char.id}
              char={char}
              onEdit={() => {
                setEditChar(char);
                setEditOpen(true);
              }}
              onDelete={() => setDeleteTarget(char)}
            />
          ))}
        </div>
      )}

      <CharacterEditDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        novelId={novelId}
      />

      {editChar && (
        <CharacterEditDialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) setEditChar(undefined);
          }}
          novelId={novelId}
          character={editChar}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa nhân vật</AlertDialogTitle>
            <AlertDialogDescription>
              Xóa &quot;{deleteTarget?.name}&quot;? Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
