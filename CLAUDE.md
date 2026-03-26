# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev       # Start dev server
pnpm build     # Production build
pnpm lint      # ESLint
```

## Architecture

Novel Studio is a local-first creative writing workspace (Vietnamese UI, `lang="vi"`). All data lives in the browser via IndexedDB (Dexie). There is no backend — the only network calls are to user-configured AI provider endpoints.

### Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript 5 (strict)
- **Tailwind CSS 4** with OKLch color tokens, `@custom-variant dark`
- **shadcn/ui** (radix-nova style, lucide icons) — components in `components/ui/`
- **Dexie 4** + `dexie-react-hooks` for IndexedDB with reactive `useLiveQuery`
- **Vercel AI SDK** (`ai` v6) with provider-specific SDKs (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/mistral`, `@ai-sdk/xai`, `@ai-sdk/openai-compatible`)
- **Zustand 5** for ephemeral UI state (chat panel, analysis progress, chapter tools)
- **streamdown** for streaming markdown rendering in chat
- **use-stick-to-bottom** for chat auto-scroll

### Data layer

Single Dexie database `novel-studio` with schema versioning in `lib/db-migrations.ts` (currently v11). Types live in `lib/db.ts`, migrations are separate.

**Content hierarchy:** Novel → Chapter → Scene (hierarchical, `order` field for reordering), Character, Note (all scoped to `novelId`)

**Novel entity includes analysis fields** (genres, tags, synopsis, world-building, factions, locations, analysis status) — these were merged from a former `NovelAnalysis` table in v10.

**AI config:** AIProvider (baseUrl, apiKey, providerType), AIModel (per provider), Conversation → ConversationMessage, ChatSettings (singleton `id: "default"`), AnalysisSettings (singleton)

Every entity hook lives in `lib/hooks/use-*.ts` and follows the same pattern: `useLiveQuery` for reads, plain async functions for mutations. All mutations auto-set `createdAt`/`updatedAt` and use `crypto.randomUUID()`. Cascading deletes use Dexie transactions. Dashboard aggregate queries live in `use-dashboard-stats.ts`.

### AI client (`lib/ai/`)

Uses Vercel AI SDK with multi-provider dispatch. `createLanguageModel(provider, modelId)` in `lib/ai/provider.ts` maps `ProviderType` to the correct `@ai-sdk/*` SDK. All models are wrapped with `extractJsonMiddleware` for reliable structured output.

Key exports: `createLanguageModel`, `generateStructured` (JSON schema extraction with retries), `PROVIDER_PRESETS` (default base URLs per provider type), `wrapWithSystemInstruction`.

### Analysis engine (`lib/analysis/`)

Three-phase pipeline: chapter analysis → novel aggregation → character profiling. Supports full re-analysis and incremental (tool-call-based) updates. Token budgeting controls depth/cost tradeoff. All analysis prompts are in Vietnamese. Results write directly to the Novel record via `db.novels.update()`.

### Layout

```
SidebarProvider
├── AppSidebar (left, collapsible offcanvas)
├── SidebarInset
│   ├── header (sidebar trigger + breadcrumb + chat toggle)
│   └── page content (flex-1 overflow-auto)
└── ChatPanel (right, 360px, shrink-0, h-svh)
```

`navConfig` in `app-sidebar.tsx` is the single source of truth for routes — the dashboard layout derives `pageTitles` from it and the homepage derives quick navigation from it.

### Fonts

Loaded via `next/font/google` in root layout as CSS variables:

- `--font-open-sans` (body/sans, with Vietnamese subset)
- `--font-playfair` (headings/serif)
- `--font-jetbrains-mono` (code/mono, with Vietnamese subset)

### Path aliases

`@/*` maps to project root (tsconfig paths). shadcn components import as `@/components/ui/*`.

### Import/Export

Two systems: `lib/novel-io.ts` for single-novel JSON export/import (v2 format, backward-compatible with v1 which had separate analyses), and `lib/db-io.ts` for full database backup/restore with encryption support and conflict resolution modes.
