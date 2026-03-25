import {
  db,
  type Novel,
  type Chapter,
  type Scene,
  type Character,
  type Note,
  type AIProvider,
  type AIModel,
  type ChatSettings,
  type AnalysisSettings,
  type Conversation,
  type ConversationMessage,
} from "@/lib/db";
import {
  encryptData,
  decryptData,
  isEncryptedPayload,
  type EncryptedPayload,
} from "@/lib/crypto";

// ─── Constants ──────────────────────────────────────────────

const CURRENT_EXPORT_VERSION = 1;
export const CURRENT_DB_VERSION = 10;

const NOVEL_SCOPED_TABLES = [
  "novels",
  "chapters",
  "scenes",
  "characters",
  "notes",
] as const;

const AI_TABLES = [
  "aiProviders",
  "aiModels",
  "chatSettings",
  "analysisSettings",
] as const;

const CHAT_TABLES = ["conversations", "conversationMessages"] as const;

const SINGLETON_TABLES = new Set(["chatSettings", "analysisSettings"]);

// Import order: characters before chapters so characterIds can be remapped
const IMPORT_ORDER = [
  "aiProviders",
  "aiModels",
  "novels",
  "characters",
  "chapters",
  "scenes",
  "notes",
  "chatSettings",
  "analysisSettings",
  "conversations",
  "conversationMessages",
] as const;

export const TABLE_LABELS: Record<string, string> = {
  novels: "Tiểu thuyết",
  chapters: "Chương",
  scenes: "Cảnh",
  characters: "Nhân vật",
  notes: "Ghi chú",
  aiProviders: "Nhà cung cấp AI",
  aiModels: "Mô hình AI",
  chatSettings: "Cài đặt chat",
  analysisSettings: "Cài đặt phân tích",
  conversations: "Hội thoại",
  conversationMessages: "Tin nhắn",
};

// Date fields per table for reviving from JSON
const DATE_FIELDS: Record<string, string[]> = {
  novels: ["createdAt", "updatedAt"],
  chapters: ["createdAt", "updatedAt", "analyzedAt"],
  scenes: ["createdAt", "updatedAt"],
  characters: ["createdAt", "updatedAt"],
  notes: ["createdAt", "updatedAt"],
  aiProviders: ["createdAt", "updatedAt"],
  aiModels: ["createdAt"],
  conversations: ["createdAt", "updatedAt"],
  conversationMessages: ["createdAt"],
  chatSettings: [],
  analysisSettings: [],
};

// FK fields that need remapping in "keep-both" mode
const FK_FIELDS: Record<string, Record<string, string>> = {
  chapters: { novelId: "novels" },
  scenes: { novelId: "novels", chapterId: "chapters" },
  characters: { novelId: "novels" },
  notes: { novelId: "novels" },
  aiModels: { providerId: "aiProviders" },
  conversations: { providerId: "aiProviders", modelId: "aiModels" },
  conversationMessages: { conversationId: "conversations" },
};

// ─── Types ──────────────────────────────────────────────────

export interface DatabaseExportMeta {
  appName: "novel-studio";
  exportVersion: number;
  dbVersion: number;
  exportedAt: string;
  tables: Record<string, number>;
}

type TableData = {
  novels?: Novel[];
  chapters?: Chapter[];
  scenes?: Scene[];
  characters?: Character[];
  notes?: Note[];
  aiProviders?: AIProvider[];
  aiModels?: AIModel[];
  chatSettings?: ChatSettings[];
  analysisSettings?: AnalysisSettings[];
  conversations?: Conversation[];
  conversationMessages?: ConversationMessage[];
};

export interface DatabaseExportData {
  meta: DatabaseExportMeta;
  data: TableData;
}

export interface ProgressInfo {
  phase: "export" | "import";
  tableName: string;
  current: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (info: ProgressInfo) => void;
export type ConflictMode = "overwrite" | "skip" | "keep-both";

export interface ExportOptions {
  novelIds?: string[];
  includeAISettings?: boolean;
  includeConversations?: boolean;
  password?: string;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}

export interface ImportPreview {
  meta: DatabaseExportMeta;
  counts: Record<string, number>;
  isEncrypted: boolean;
}

export interface ImportOptions {
  conflictMode: ConflictMode;
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}

// ─── Storage Stats ──────────────────────────────────────────

export interface StorageStats {
  tableCounts: Record<string, number>;
  totalRecords: number;
  storageUsage?: number; // bytes, from navigator.storage.estimate()
  storageQuota?: number; // bytes
}

export async function getStorageStats(): Promise<StorageStats> {
  const tableCounts: Record<string, number> = {};
  let totalRecords = 0;

  for (const name of IMPORT_ORDER) {
    const count = await getTable(name).count();
    tableCounts[name] = count;
    totalRecords += count;
  }

  let storageUsage: number | undefined;
  let storageQuota: number | undefined;
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      storageUsage = estimate.usage;
      storageQuota = estimate.quota;
    } catch {
      // Silently ignore — not all browsers support this
    }
  }

  return { tableCounts, totalRecords, storageUsage, storageQuota };
}

// ─── Helpers ────────────────────────────────────────────────

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Đã huỷ thao tác.", "AbortError");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reviveDates(records: any[], tableName: string): any[] {
  const fields = DATE_FIELDS[tableName];
  if (!fields || fields.length === 0) return records;
  return records.map((r) => {
    const copy = { ...r };
    for (const field of fields) {
      if (copy[field]) copy[field] = new Date(copy[field] as string);
    }
    return copy;
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF _-]/g, "_");
}

function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getTable(name: string) {
  return db.table(name);
}

// ─── Shared Parser ──────────────────────────────────────────

async function parseExportFile(
  file: File,
  password?: string,
): Promise<{ data: DatabaseExportData; isEncrypted: boolean }> {
  const text = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Tệp JSON không hợp lệ.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Định dạng tệp không đúng.");
  }

  let isEncrypted = false;
  if (isEncryptedPayload(parsed)) {
    isEncrypted = true;
    if (!password) {
      throw new Error("ENCRYPTED");
    }
    const decrypted = await decryptData(parsed as EncryptedPayload, password);
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      throw new Error("Dữ liệu giải mã không hợp lệ.");
    }
  }

  const exportData = parsed as DatabaseExportData;

  if (
    !exportData.meta?.appName ||
    exportData.meta.appName !== "novel-studio"
  ) {
    throw new Error("Tệp không phải từ Novel Studio.");
  }

  return { data: exportData, isEncrypted };
}

// ─── Export ─────────────────────────────────────────────────

export async function exportDatabase(
  options: ExportOptions = {},
): Promise<void> {
  const {
    novelIds,
    includeAISettings = true,
    includeConversations = true,
    password,
    onProgress,
    signal,
  } = options;

  const isPerNovel = novelIds && novelIds.length > 0;

  // Determine tables to export
  const tablesToExport: string[] = [...NOVEL_SCOPED_TABLES];
  if (!isPerNovel) {
    if (includeAISettings) tablesToExport.push(...AI_TABLES);
    if (includeConversations) tablesToExport.push(...CHAT_TABLES);
  }

  const data: TableData = {};
  const total = tablesToExport.length;

  for (let i = 0; i < tablesToExport.length; i++) {
    checkAbort(signal);
    const tableName = tablesToExport[i];

    onProgress?.({
      phase: "export",
      tableName: TABLE_LABELS[tableName] || tableName,
      current: i + 1,
      total,
      percentage: Math.round(((i + 1) / total) * 100),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let records: any[];

    if (
      isPerNovel &&
      (NOVEL_SCOPED_TABLES as readonly string[]).includes(tableName) &&
      tableName !== "novels"
    ) {
      const allRecords = await Promise.all(
        novelIds.map((id) =>
          getTable(tableName).where("novelId").equals(id).toArray(),
        ),
      );
      records = allRecords.flat();
    } else if (isPerNovel && tableName === "novels") {
      records = (
        await Promise.all(novelIds.map((id) => db.novels.get(id)))
      ).filter(Boolean);
    } else {
      records = await getTable(tableName).toArray();
    }

    (data as Record<string, unknown>)[tableName] = records;

    await new Promise((r) => setTimeout(r, 0));
  }

  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    counts[key] = (value as unknown[])?.length ?? 0;
  }

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalRecords === 0) {
    throw new Error("Không có dữ liệu để xuất.");
  }

  const meta: DatabaseExportMeta = {
    appName: "novel-studio",
    exportVersion: CURRENT_EXPORT_VERSION,
    dbVersion: CURRENT_DB_VERSION,
    exportedAt: new Date().toISOString(),
    tables: counts,
  };

  const exportData: DatabaseExportData = { meta, data };
  // Don't pretty-print if encrypting (saves ~30% size)
  const json = JSON.stringify(exportData, null, password ? undefined : 2);

  checkAbort(signal);

  let output: string;
  if (password) {
    const encrypted = await encryptData(json, password);
    output = JSON.stringify({
      meta: {
        appName: "novel-studio" as const,
        exportVersion: CURRENT_EXPORT_VERSION,
      },
      ...encrypted,
    });
  } else {
    output = json;
  }

  // Generate filename — use already-fetched novel data
  let filename: string;
  if (isPerNovel && novelIds.length === 1) {
    const novels = data.novels;
    const title =
      novels?.[0]?.title ? sanitizeFilename(novels[0].title) : "novel";
    filename = `novel-studio-${title}-${new Date().toISOString().slice(0, 10)}.json`;
  } else {
    filename = `novel-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
  }

  downloadJson(output, filename);
}

// ─── Import Preview ─────────────────────────────────────────

export async function previewImportFile(
  file: File,
  password?: string,
): Promise<ImportPreview> {
  const { data: exportData, isEncrypted } = await parseExportFile(
    file,
    password,
  );

  const counts: Record<string, number> = {};
  if (exportData.data) {
    for (const [key, value] of Object.entries(exportData.data)) {
      if (Array.isArray(value)) {
        counts[key] = value.length;
      }
    }
  }

  return { meta: exportData.meta, counts, isEncrypted };
}

// ─── Import ─────────────────────────────────────────────────

export async function importDatabase(
  file: File,
  options: ImportOptions,
  password?: string,
): Promise<void> {
  const { conflictMode, onProgress, signal } = options;

  const { data: exportData } = await parseExportFile(file, password);

  if (exportData.meta.dbVersion > CURRENT_DB_VERSION) {
    console.warn(
      `Tệp từ phiên bản DB mới hơn (${exportData.meta.dbVersion} > ${CURRENT_DB_VERSION}). Có thể xảy ra lỗi.`,
    );
  }

  const data = exportData.data;
  if (!data) throw new Error("Không có dữ liệu trong tệp.");

  // Build ID remap maps for "keep-both" mode
  const idMaps: Record<string, Map<string, string>> = {};

  // Determine which tables have data
  const tablesToImport = IMPORT_ORDER.filter((t) => {
    const arr = data[t as keyof TableData];
    return Array.isArray(arr) && arr.length > 0;
  });

  const total = tablesToImport.length;

  for (let i = 0; i < tablesToImport.length; i++) {
    checkAbort(signal);
    const tableName = tablesToImport[i];

    onProgress?.({
      phase: "import",
      tableName: TABLE_LABELS[tableName] || tableName,
      current: i + 1,
      total,
      percentage: Math.round(((i + 1) / total) * 100),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let records: any[] = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(data[tableName as keyof TableData] as any[]),
    ];

    // Revive dates from ISO strings
    records = reviveDates(records, tableName);

    const table = getTable(tableName);

    if (conflictMode === "overwrite") {
      await table.bulkPut(records);
    } else if (conflictMode === "skip") {
      // Use primaryKeys() instead of toArray() — avoids loading full records
      const existingIds = new Set(await table.toCollection().primaryKeys());
      const newRecords = records.filter(
        (r) => !existingIds.has(r.id as string),
      );
      if (newRecords.length > 0) {
        await table.bulkAdd(newRecords);
      }
    } else if (conflictMode === "keep-both") {
      // Singletons: use overwrite semantics (can't have two "default" rows)
      if (SINGLETON_TABLES.has(tableName)) {
        await table.bulkPut(records);
      } else {
        // Remap all IDs to new UUIDs
        const idMap = new Map<string, string>();
        idMaps[tableName] = idMap;

        records = records.map((r) => {
          const newId = crypto.randomUUID();
          idMap.set(r.id as string, newId);
          const copy: Record<string, unknown> = { ...r, id: newId };

          // Remap FK fields
          const fkDefs = FK_FIELDS[tableName];
          if (fkDefs) {
            for (const [field, refTable] of Object.entries(fkDefs)) {
              if (copy[field] && idMaps[refTable]) {
                copy[field] =
                  idMaps[refTable].get(copy[field] as string) ?? copy[field];
              }
            }
          }

          // Special case: chapters.characterIds is an array of character IDs
          if (
            tableName === "chapters" &&
            Array.isArray(copy.characterIds) &&
            idMaps.characters
          ) {
            copy.characterIds = (copy.characterIds as string[]).map(
              (cid) => idMaps.characters.get(cid) ?? cid,
            );
          }

          return copy;
        });

        await table.bulkAdd(records);
      }
    }

    await new Promise((r) => setTimeout(r, 0));
  }
}
