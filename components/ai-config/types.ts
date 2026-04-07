export type ConfigItemId =
  | "global-instruction"
  | "chat-panel"
  | "analysis-chapter"
  | "analysis-aggregation"
  | "analysis-character"
  | "chapter-translate"
  | "chapter-review"
  | "chapter-rewrite"
  | "autowrite-setup"
  | "autowrite-world"
  | "autowrite-characters"
  | "autowrite-arcs"
  | "autowrite-plans"
  | "autowrite-context"
  | "autowrite-direction"
  | "autowrite-outline"
  | "autowrite-writer"
  | "autowrite-review"
  | "autowrite-rewrite";

export interface TreeLeaf {
  type: "leaf";
  id: ConfigItemId;
  label: string;
}

export interface TreeFolder {
  type: "folder";
  id: string;
  label: string;
  children: (TreeLeaf | TreeFolder)[];
}

export type TreeNode = TreeLeaf | TreeFolder;

export const TREE_STRUCTURE: TreeNode[] = [
  { type: "leaf", id: "global-instruction", label: "Chỉ thị chung" },
  { type: "leaf", id: "chat-panel", label: "Chat panel" },
  {
    type: "folder",
    id: "analysis",
    label: "Công cụ phân tích",
    children: [
      { type: "leaf", id: "analysis-chapter", label: "Phân tích chương" },
      { type: "leaf", id: "analysis-aggregation", label: "Tổng hợp tiểu thuyết" },
      { type: "leaf", id: "analysis-character", label: "Hồ sơ nhân vật" },
    ],
  },
  {
    type: "folder",
    id: "chapter-tools",
    label: "Công cụ chương",
    children: [
      { type: "leaf", id: "chapter-translate", label: "Dịch thuật" },
      { type: "leaf", id: "chapter-review", label: "Đánh giá" },
      { type: "leaf", id: "chapter-rewrite", label: "Viết lại" },
    ],
  },
  {
    type: "folder",
    id: "autowrite",
    label: "Tự động viết",
    children: [
      {
        type: "folder",
        id: "autowrite-setup-folder",
        label: "Cài đặt",
        children: [
          { type: "leaf", id: "autowrite-setup", label: "Pipeline" },
          { type: "leaf", id: "autowrite-world", label: "Thế giới quan" },
          { type: "leaf", id: "autowrite-characters", label: "Nhân vật" },
          { type: "leaf", id: "autowrite-arcs", label: "Mạch truyện" },
          { type: "leaf", id: "autowrite-plans", label: "Kế hoạch chương" },
        ],
      },
      {
        type: "folder",
        id: "autowrite-pipeline-folder",
        label: "Pipeline",
        children: [
          { type: "leaf", id: "autowrite-context", label: "Bối cảnh" },
          { type: "leaf", id: "autowrite-direction", label: "Hướng đi" },
          { type: "leaf", id: "autowrite-outline", label: "Giàn ý" },
          { type: "leaf", id: "autowrite-writer", label: "Viết truyện" },
          { type: "leaf", id: "autowrite-review", label: "Đánh giá" },
          { type: "leaf", id: "autowrite-rewrite", label: "Viết lại" },
        ],
      },
    ],
  },
];
