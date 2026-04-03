"use client";

import { LoaderCircleIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type SyncProgress = {
  label: string;
  percentage: number;
  detail?: string;
};

type SyncProgressCardProps = {
  progress: SyncProgress;
};

export function SyncProgressCard({ progress }: SyncProgressCardProps) {
  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <LoaderCircleIcon className="size-4 animate-spin text-primary" />
          {progress.label}
        </span>
        <span className="tabular-nums text-muted-foreground">{progress.percentage}%</span>
      </div>
      <Progress value={progress.percentage} className="h-2" />
      {progress.detail && <p className="text-xs text-muted-foreground">{progress.detail}</p>}
    </div>
  );
}
