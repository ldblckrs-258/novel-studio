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
  type NameEntry,
  type ReplaceRule,
  type ExcludedName,
} from "@/lib/db";
import {
  encryptData,
  decryptData,
  isEncryptedPayload,
  type EncryptedPayload,
} from "@/lib/crypto";

// ─── Constants ──────────────────────────────────────────────

const CURRENT_EXPORT_VERSION = 1;
export const CURRENT_DB_VERSION = 9;

const NOVEL_SCOPED_TABLES = [
  "novels",
  "chapters",
  "scenes",
  "characters",
  "notes",
  "nameEntries",
  "replaceRules",
  "excludedNames",
  "nameFrequency",
  "plotArcs",
  "chapterPlans",
  "characterArcs",
  "writingSettings",
  "writingSessions",
  "writingStepResults",
] as const;

const AI_TABLES = [
  "aiProviders",
  "aiModels",
  "chatSettings",
  "analysisSettings",
] as const;

const CHAT_TABLES = ["conversations", "conversationMessages"] as const;
const QT_BASE_TABLES = ["dictMeta", "convertSettings"] as const;
const QT_LARGE_TABLES = ["dictCache", "dictEntries"] as const;
const OTHER_GLOBAL_TABLES = ["ttsSettings"] as const;

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
  "nameEntries",
  "replaceRules",
  "excludedNames",
  "nameFrequency",
  "plotArcs",
  "chapterPlans",
  "characterArcs",
  "writingSettings",
  "writingSessions",
  "writingStepResults",
  "dictMeta",
  "dictCache",
  "dictEntries",
  "convertSettings",
  "ttsSettings",
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
  nameEntries: "Từ điển tên",
  replaceRules: "Quy tắc thay thế",
  excludedNames: "Tên loại trừ",
  dictEntries: "Từ điển QT",
  dictMeta: "Metadata từ điển QT",
  dictCache: "Cache từ điển QT",
  convertSettings: "Cài đặt chuyển đổi QT",
  nameFrequency: "Tần suất tên",
  ttsSettings: "Cài đặt TTS",
  plotArcs: "Tuyến truyện",
  chapterPlans: "Kế hoạch chương",
  characterArcs: "Tiến trình nhân vật",
  writingSettings: "Cài đặt viết",
  writingSessions: "Phiên viết",
  writingStepResults: "Kết quả bước viết",
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
  nameEntries: ["createdAt", "updatedAt"],
  replaceRules: ["createdAt", "updatedAt"],
  excludedNames: ["createdAt", "updatedAt"],
  dictMeta: ["loadedAt"],
  nameFrequency: ["createdAt", "updatedAt"],
  plotArcs: ["createdAt", "updatedAt"],
  chapterPlans: ["createdAt", "updatedAt"],
  characterArcs: ["createdAt", "updatedAt"],
  writingSettings: ["createdAt", "updatedAt"],
  writingSessions: ["createdAt", "updatedAt"],
  writingStepResults: ["startedAt", "completedAt"],
};

// FK fields that need remapping in "keep-both" mode
const FK_FIELDS: Record<string, Record<string, string>> = {
  chapters: { novelId: "novels" },
  scenes: { novelId: "novels", chapterId: "chapters", activeSceneId: "scenes" },
  characters: { novelId: "novels" },
  notes: { novelId: "novels" },
  nameEntries: { scope: "novels" },
  replaceRules: { scope: "novels" },
  excludedNames: { scope: "novels" },
  nameFrequency: { novelId: "novels" },
  plotArcs: { novelId: "novels" },
  chapterPlans: { novelId: "novels", chapterId: "chapters" },
  characterArcs: { novelId: "novels", characterId: "characters" },
  writingSessions: { novelId: "novels", chapterPlanId: "chapterPlans" },
  writingStepResults: { sessionId: "writingSessions" },
  aiModels: { providerId: "aiProviders" },
  conversations: {
    providerId: "aiProviders",
    modelId: "aiModels",
    novelId: "novels",
    chapterId: "chapters",
  },
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
  nameEntries?: NameEntry[];
  replaceRules?: ReplaceRule[];
  excludedNames?: ExcludedName[];
  aiProviders?: AIProvider[];
  aiModels?: AIModel[];
  chatSettings?: ChatSettings[];
  analysisSettings?: AnalysisSettings[];
  conversations?: Conversation[];
  conversationMessages?: ConversationMessage[];
  dictEntries?: Array<{ id: string; source: string; chinese: string; vietnamese: string }>;
  dictMeta?: Array<{ id: string; loadedAt: Date; sources: Record<string, number> }>;
  dictCache?: Array<{ source: string; rawText: string }>;
  convertSettings?: Array<{
    id: string;
    nameVsPriority: string;
    scopePriority: string;
    maxPhraseLength: number;
    vpLengthPriority: string;
    luatNhanMode: string;
    splitMode: string;
    capitalizeBrackets?: boolean;
  }>;
  nameFrequency?: Array<{
    id: string;
    novelId: string;
    chinese: string;
    reading: string;
    count: number;
    chapters: string[];
    surnameType: "compound" | "single" | "rare";
    status: "pending" | "approved" | "rejected";
    createdAt: Date;
    updatedAt: Date;
  }>;
  ttsSettings?: Array<{
    id: "default";
    providerId: string;
    voiceId: string;
    rate: number;
    pitch: number;
    highlightColor: string;
    fluencyAdjust: number;
    providerApiKeys?: Record<string, string>;
  }>;
  plotArcs?: Array<{
    id: string;
    novelId: string;
    title: string;
    description: string;
    type: "main" | "subplot" | "character";
    plotPoints: Array<{
      id: string;
      title: string;
      description: string;
      chapterOrder?: number;
      status: "planned" | "in-progress" | "resolved";
    }>;
    status: "active" | "completed" | "abandoned";
    createdAt: Date;
    updatedAt: Date;
  }>;
  chapterPlans?: Array<{
    id: string;
    novelId: string;
    chapterOrder: number;
    title?: string;
    directions: string[];
    outline: string;
    scenes: Array<{
      title: string;
      summary: string;
      characters: string[];
      location?: string;
      mood?: string;
    }>;
    status: "planned" | "writing" | "written" | "reviewed" | "saved";
    chapterId?: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  characterArcs?: Array<{
    id: string;
    novelId: string;
    characterId: string;
    trajectory: string;
    developments: Array<{ chapterOrder: number; description: string }>;
    createdAt: Date;
    updatedAt: Date;
  }>;
  writingSettings?: Array<{
    id: string;
    chapterLength: number;
    contextModel?: { providerId: string; modelId: string };
    directionModel?: { providerId: string; modelId: string };
    outlineModel?: { providerId: string; modelId: string };
    writerModel?: { providerId: string; modelId: string };
    reviewModel?: { providerId: string; modelId: string };
    rewriteModel?: { providerId: string; modelId: string };
    contextPrompt?: string;
    directionPrompt?: string;
    outlinePrompt?: string;
    writerPrompt?: string;
    reviewPrompt?: string;
    rewritePrompt?: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  writingSessions?: Array<{
    id: string;
    novelId: string;
    chapterPlanId: string;
    currentStep: "context" | "direction" | "outline" | "writer" | "review" | "rewrite";
    status: "active" | "paused" | "completed" | "error";
    contextHash?: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  writingStepResults?: Array<{
    id: string;
    sessionId: string;
    role: "context" | "direction" | "outline" | "writer" | "review" | "rewrite";
    status: "pending" | "running" | "completed" | "editing" | "skipped" | "error";
    output?: string;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }>;
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
export type ExportStage = "collect" | "combine" | "encrypt" | "finalize";

export interface ExportStageInfo {
  stage: ExportStage;
  percentage: number;
  message: string;
}

export type ExportStageProgressCallback = (info: ExportStageInfo) => void;

export interface ExportOptions {
  novelIds?: string[];
  includeAISettings?: boolean;
  includeConversations?: boolean;
  includeLargeDictionaryData?: boolean;
  password?: string;
  onProgress?: ProgressCallback;
  onStageProgress?: ExportStageProgressCallback;
  signal?: AbortSignal;
}

export interface ExportPayload {
  json: string;
  filename: string;
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

function sanitizeConversationMessagesForExport(
  records: ConversationMessage[],
): ConversationMessage[] {
  return records.map((message) => {
    const { images: _images, files: _files, ...safeMessage } = message;
    return safeMessage;
  });
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

export async function buildExportPayload(
  options: ExportOptions = {},
): Promise<ExportPayload> {
  const {
    novelIds,
    includeAISettings = true,
    includeConversations = true,
    includeLargeDictionaryData = true,
    password,
    onProgress,
    onStageProgress,
    signal,
  } = options;

  const isPerNovel = novelIds && novelIds.length > 0;

  // Determine tables to export
  const tablesToExport: string[] = [...NOVEL_SCOPED_TABLES];
  if (!isPerNovel) {
    tablesToExport.push(...QT_BASE_TABLES, ...OTHER_GLOBAL_TABLES);
    if (includeLargeDictionaryData) {
      tablesToExport.push(...QT_LARGE_TABLES);
    }
    if (includeAISettings) tablesToExport.push(...AI_TABLES);
    if (includeConversations) tablesToExport.push(...CHAT_TABLES);
  } else {
    tablesToExport.push(...CHAT_TABLES);
  }

  const data: TableData = {};
  const total = tablesToExport.length;
  onStageProgress?.({
    stage: "collect",
    percentage: 0,
    message: "Đang thu thập dữ liệu",
  });

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

    // Tables that use "scope" instead of "novelId" as the foreign key to novels
    const SCOPE_KEYED_TABLES = new Set([
      "nameEntries",
      "replaceRules",
      "excludedNames",
    ]);

    if (
      isPerNovel &&
      (NOVEL_SCOPED_TABLES as readonly string[]).includes(tableName) &&
      tableName !== "novels"
    ) {
      const fkField = SCOPE_KEYED_TABLES.has(tableName) ? "scope" : "novelId";
      const allRecords = await Promise.all(
        novelIds.map((id) =>
          getTable(tableName).where(fkField).equals(id).toArray(),
        ),
      );
      records = allRecords.flat();
    } else if (isPerNovel && tableName === "novels") {
      records = (
        await Promise.all(novelIds.map((id) => db.novels.get(id)))
      ).filter(Boolean);
    } else if (isPerNovel && tableName === "conversations") {
      const allRecords = await Promise.all(
        novelIds.map((id) =>
          getTable(tableName).where("novelId").equals(id).toArray(),
        ),
      );
      records = allRecords.flat();
    } else if (isPerNovel && tableName === "conversationMessages") {
      const conversations = await Promise.all(
        novelIds.map((id) => db.conversations.where("novelId").equals(id).toArray()),
      );
      const conversationIds = conversations.flat().map((c) => c.id);
      const allRecords = await Promise.all(
        conversationIds.map((id) =>
          getTable(tableName).where("conversationId").equals(id).toArray(),
        ),
      );
      records = allRecords.flat();
    } else {
      records = await getTable(tableName).toArray();
    }

    if (tableName === "conversationMessages") {
      records = sanitizeConversationMessagesForExport(
        records as ConversationMessage[],
      );
    }

    (data as Record<string, unknown>)[tableName] = records;

    await new Promise((r) => setTimeout(r, 0));
  }

  onStageProgress?.({
    stage: "combine",
    percentage: password ? 75 : 92,
    message: "Đang kết hợp dữ liệu",
  });

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
    onStageProgress?.({
      stage: "encrypt",
      percentage: 90,
      message: "Đang mã hoá dữ liệu",
    });
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

  onStageProgress?.({
    stage: "finalize",
    percentage: 100,
    message: "Đóng gói hoàn tất",
  });

  return {
    json: output,
    filename,
  };
}

export async function exportDatabase(
  options: ExportOptions = {},
): Promise<void> {
  const payload = await buildExportPayload(options);
  downloadJson(payload.json, payload.filename);
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
      } else if (tableName === "writingSettings") {
        records = records.map((r) => ({
          ...r,
          id: idMaps.novels?.get(r.id as string) ?? r.id,
        }));
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
