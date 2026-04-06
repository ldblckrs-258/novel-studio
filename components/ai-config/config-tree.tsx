"use client";

import { cn } from "@/lib/utils";
import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react";
import { useState } from "react";
import type { ConfigItemId, TreeFolder, TreeLeaf, TreeNode } from "./types";
import { TREE_STRUCTURE } from "./types";

interface ConfigTreeProps {
  selected: ConfigItemId;
  onSelect: (id: ConfigItemId) => void;
}

function LeafItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeLeaf;
  depth: number;
  selected: ConfigItemId;
  onSelect: (id: ConfigItemId) => void;
}) {
  const isActive = selected === node.id;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md py-1.5 pr-3 text-left text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <FileTextIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="truncate">{node.label}</span>
    </button>
  );
}

function FolderItem({
  node,
  depth,
  selected,
  onSelect,
  defaultOpen = true,
}: {
  node: TreeFolder;
  depth: number;
  selected: ConfigItemId;
  onSelect: (id: ConfigItemId) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className="flex w-full items-center gap-2 rounded-md py-1.5 pr-3 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-accent/40 hover:text-foreground"
      >
        <ChevronRightIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
            open && "rotate-90",
          )}
        />
        {open ? (
          <FolderOpenIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/80" />
        ) : (
          <FolderIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/80" />
        )}
        <span className="truncate">{node.label}</span>
      </button>
      {open && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNodeItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: ConfigItemId;
  onSelect: (id: ConfigItemId) => void;
}) {
  if (node.type === "leaf") {
    return (
      <LeafItem
        node={node}
        depth={depth}
        selected={selected}
        onSelect={onSelect}
      />
    );
  }
  return (
    <FolderItem
      node={node}
      depth={depth}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

export function ConfigTree({ selected, onSelect }: ConfigTreeProps) {
  return (
    <nav className="space-y-0.5 p-2">
      {TREE_STRUCTURE.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          depth={0}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}
