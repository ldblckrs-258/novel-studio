"use client";

import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_META,
  changelog,
  type ChangeCategory,
  type ChangeEntry,
  type ChangelogRelease,
} from "@/data/changelog";
import {
  AlertTriangleIcon,
  BugIcon,
  FilterIcon,
  RefreshCwIcon,
  SparklesIcon,
  TagIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

const CATEGORY_ICONS: Record<
  ChangeCategory,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  feature: SparklesIcon,
  fix: BugIcon,
  improvement: WrenchIcon,
  breaking: AlertTriangleIcon,
  removed: Trash2Icon,
  refactor: RefreshCwIcon,
};

function CategoryBadge({ category }: { category: ChangeCategory }) {
  const meta = CATEGORY_META[category];
  const Icon = CATEGORY_ICONS[category];
  return (
    <span
      className={`inline-flex w-full items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none ${meta.className}`}
    >
      <Icon className="size-3 shrink-0" />
      {meta.label}
    </span>
  );
}

function ChangeItem({ entry }: { entry: ChangeEntry }) {
  return (
    <li className="flex gap-3 py-2 first:pt-0 last:pb-0">
      <div className="w-[140px] shrink-0 pt-px">
        <CategoryBadge category={entry.category} />
        {entry.tags && entry.tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-foreground">
          {entry.description}
        </p>
        {entry.details && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {entry.details}
          </p>
        )}
      </div>
    </li>
  );
}

function ReleaseCard({
  release,
  isLatest,
}: {
  release: ChangelogRelease;
  isLatest: boolean;
}) {
  const formattedDate = new Date(release.date).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      id={release.version}
      className="group/release relative pb-10 pl-8 last:pb-0"
    >
      {/* Timeline connector */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-border group-last/release:bottom-auto group-last/release:h-3" />

      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-1.5 size-2.5 -translate-x-1/2 rounded-full border-2 border-background ${
          isLatest ? "bg-primary" : "bg-muted-foreground/40"
        }`}
      />

      {/* Release header */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-foreground">
          v{release.version}
        </span>
        <span className="text-xs text-muted-foreground">{formattedDate}</span>
        {isLatest && (
          <Badge variant="default" className="h-4 text-[10px]">
            Mới nhất
          </Badge>
        )}
      </div>

      {/* Release title & summary */}
      {release.title && (
        <h3 className="mb-1 font-heading text-lg font-semibold tracking-tight text-foreground">
          {release.title}
        </h3>
      )}
      {release.summary && (
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          {release.summary}
        </p>
      )}

      {/* Changes list */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <ul className="divide-y divide-border px-4 py-3">
          {release.changes.map((entry, i) => (
            <ChangeItem key={i} entry={entry} />
          ))}
        </ul>
      </div>
    </div>
  );
}

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as ChangeCategory[];

export default function ChangelogPage() {
  const [activeFilters, setActiveFilters] = useState<Set<ChangeCategory>>(
    new Set(),
  );

  const toggleFilter = (cat: ChangeCategory) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const filteredReleases = useMemo(() => {
    if (activeFilters.size === 0) return changelog;
    return changelog
      .map((release) => ({
        ...release,
        changes: release.changes.filter((c) => activeFilters.has(c.category)),
      }))
      .filter((release) => release.changes.length > 0);
  }, [activeFilters]);

  // Collect which categories actually exist in data
  const usedCategories = useMemo(() => {
    const cats = new Set<ChangeCategory>();
    for (const release of changelog) {
      for (const change of release.changes) {
        cats.add(change.category);
      }
    }
    return ALL_CATEGORIES.filter((c) => cats.has(c));
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Nhật ký thay đổi
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lịch sử cập nhật và phát triển Novel Studio.
        </p>
      </div>

      {/* Filter bar */}
      {usedCategories.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <FilterIcon className="size-3.5 text-muted-foreground" />
          {usedCategories.map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = CATEGORY_ICONS[cat];
            const isActive = activeFilters.has(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleFilter(cat)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? `${meta.className} border-transparent`
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-3" />
                {meta.label}
              </button>
            );
          })}
          {activeFilters.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilters(new Set())}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Xoá bộ lọc
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      {filteredReleases.length > 0 ? (
        <div className="relative">
          {filteredReleases.map((release, i) => (
            <ReleaseCard
              key={release.version}
              release={release}
              isLatest={i === 0}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <TagIcon className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Không có thay đổi nào phù hợp với bộ lọc.
          </p>
          <button
            type="button"
            onClick={() => setActiveFilters(new Set())}
            className="text-xs text-primary underline underline-offset-2"
          >
            Xoá bộ lọc
          </button>
        </div>
      )}
    </main>
  );
}
