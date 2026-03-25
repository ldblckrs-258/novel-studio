"use client";

import { ProviderIcon } from "@/components/provider-icon";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PROVIDER_PRESETS, getPreset } from "@/lib/ai/presets";
import type { AIProvider, ProviderType } from "@/lib/db";
import { db } from "@/lib/db";
import {
  createAIProvider,
  deleteAIModel,
  deleteAIProvider,
  fetchAndSyncModels,
  updateAIProvider,
  useAIModels,
  useAIProviders,
} from "@/lib/hooks";
import {
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ServerIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Provider Form Dialog ───────────────────────────────────

function ProviderFormDialog({
  open,
  onOpenChange,
  provider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: AIProvider;
}) {
  const [providerType, setProviderType] = useState<ProviderType>(
    provider?.providerType ?? "openai-compatible",
  );
  const [name, setName] = useState(provider?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(provider?.apiKey ?? "");
  const [saving, setSaving] = useState(false);

  const isEditing = !!provider;
  const preset = getPreset(providerType);

  function handlePresetChange(type: ProviderType) {
    setProviderType(type);
    const p = getPreset(type);
    if (p) {
      if (!name || name === getPreset(providerType)?.label) {
        setName(p.label);
      }
      if (p.defaultBaseUrl) {
        setBaseUrl(p.defaultBaseUrl);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    if (providerType === "openai-compatible" && !baseUrl.trim()) return;

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        baseUrl: baseUrl.trim() || preset?.defaultBaseUrl || "",
        apiKey: apiKey.trim(),
        providerType,
      };

      if (isEditing) {
        await updateAIProvider(provider.id, data);
        toast.success("Đã cập nhật nhà cung cấp");
      } else {
        const id = await createAIProvider({ ...data, isActive: true });

        // Auto-populate known models for native providers
        if (preset && preset.popularModels.length > 0) {
          const now = new Date();
          await db.aiModels.bulkAdd(
            preset.popularModels.map((modelId) => ({
              id: crypto.randomUUID(),
              providerId: id,
              modelId,
              name: modelId,
              createdAt: now,
            })),
          );
        }

        toast.success("Đã thêm nhà cung cấp");
      }
      onOpenChange(false);
    } catch {
      toast.error("Lưu nhà cung cấp thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cập nhật cấu hình nhà cung cấp."
              : "Chọn nền tảng hoặc cấu hình endpoint tùy chỉnh."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldSet>
            <FieldGroup>
              {/* Platform selector — only for new providers */}
              {!isEditing && (
                <Field>
                  <FieldLabel>Nền tảng</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {PROVIDER_PRESETS.map((p) => (
                      <Tooltip key={p.type}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handlePresetChange(p.type)}
                            className={`flex size-10 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                              providerType === p.type
                                ? "border-primary bg-primary/10"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <ProviderIcon
                              iconKey={p.iconKey}
                              className="size-5"
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="flex flex-col items-center max-w-[200px]"
                        >
                          <p className="font-medium block">{p.label}</p>
                          <p className="text-xs text-gray-300 block text-center">
                            {p.description}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </Field>
              )}

              <Field>
                <FieldLabel>Tên</FieldLabel>
                <Input
                  placeholder="Nhà cung cấp của tôi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>

              {/* Base URL — only shown if editable or openai-compatible */}
              {(preset?.baseUrlEditable || isEditing) && (
                <Field>
                  <FieldLabel>Base URL</FieldLabel>
                  <Input
                    placeholder="https://api.example.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    required={providerType === "openai-compatible"}
                  />
                  <FieldDescription>
                    {providerType === "openai-compatible"
                      ? "URL gốc cho API tương thích OpenAI"
                      : `Mặc định: ${preset?.defaultBaseUrl}`}
                  </FieldDescription>
                </Field>
              )}

              <Field>
                <FieldLabel>Khóa API</FieldLabel>
                <Input
                  type="password"
                  placeholder={preset?.apiKeyPlaceholder ?? "Khóa API"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <FieldDescription>
                  Chỉ lưu trữ cục bộ trong trình duyệt của bạn.
                  {preset?.apiKeyHelpUrl && (
                    <>
                      {" "}
                      <a
                        href={preset.apiKeyHelpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary underline"
                      >
                        Lấy khóa API
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    </>
                  )}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Đang lưu..."
                : isEditing
                  ? "Lưu thay đổi"
                  : "Thêm nhà cung cấp"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Provider Card ──────────────────────────────────────────

function ProviderCard({ provider }: { provider: AIProvider }) {
  const models = useAIModels(provider.id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const preset = getPreset(provider.providerType ?? "openai-compatible");

  async function handleFetchModels() {
    setFetching(true);
    try {
      const count = await fetchAndSyncModels(provider);
      toast.success(`Đã tải ${count} mô hình`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải mô hình thất bại");
    } finally {
      setFetching(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteAIProvider(provider.id);
      toast.success("Đã xóa nhà cung cấp");
    } catch {
      toast.error("Xóa nhà cung cấp thất bại");
    }
  }

  const maskedKey = provider.apiKey
    ? `${provider.apiKey.slice(0, 7)}${"•".repeat(Math.max(0, provider.apiKey.length - 11))}${provider.apiKey.slice(-4)}`
    : "Chưa đặt";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {preset?.iconKey && (
              <ProviderIcon iconKey={preset.iconKey} className="size-4" />
            )}
            <CardTitle>{provider.name}</CardTitle>
          </div>
          <CardDescription className="truncate font-mono text-xs">
            {provider.providerType === "openai-compatible"
              ? provider.baseUrl
              : (preset?.label ?? provider.baseUrl)}
          </CardDescription>
          <CardAction>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditOpen(true)}
              >
                <PencilIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeleteOpen(true)}
              >
                <TrashIcon />
              </Button>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Khóa API:</span>
            <code className="flex-1 truncate">
              {showKey ? provider.apiKey || "Chưa đặt" : maskedKey}
            </code>
            {provider.apiKey && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Mô hình ({models?.length ?? 0})
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={handleFetchModels}
                disabled={fetching}
              >
                {fetching ? (
                  <LoaderIcon className="animate-spin" />
                ) : (
                  <RefreshCwIcon />
                )}
                {fetching ? "Đang tải..." : "Tải mô hình"}
              </Button>
            </div>
            {models && models.length > 0 ? (
              <div className="max-h-32 overflow-y-auto rounded-md border p-2">
                <div className="flex flex-wrap gap-1.5">
                  {models.map((m) => (
                    <Badge
                      key={m.id}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {m.name}
                      <button
                        type="button"
                        onClick={() => deleteAIModel(m.id)}
                        className="ml-0.5 rounded-sm p-0.5 opacity-50 transition-opacity hover:bg-muted hover:opacity-100"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Chưa tải mô hình. Nhấn &quot;Tải mô hình&quot; để tải danh sách
                mô hình có sẵn.
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground">
          Thêm ngày {provider.createdAt.toLocaleDateString("vi-VN")}
        </CardFooter>
      </Card>

      {editOpen && (
        <ProviderFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          provider={provider}
        />
      )}

      {deleteOpen && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa nhà cung cấp</AlertDialogTitle>
              <AlertDialogDescription>
                Thao tác này sẽ xóa vĩnh viễn &quot;{provider.name}&quot; và tất
                cả mô hình đã tải. Không thể hoàn tác.
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
      )}
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────

export function AIProviderSettings() {
  const providers = useAIProviders();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="mb-4">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Nhà cung cấp AI
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cấu hình nền tảng AI cho trò chuyện và phân tích.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <PlusIcon />
          Thêm nhà cung cấp
        </Button>
      </div>

      {providers === undefined ? (
        <div className="flex justify-center py-12">
          <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : providers.length === 0 ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ServerIcon />
            </EmptyMedia>
            <EmptyTitle>Chưa cấu hình nhà cung cấp</EmptyTitle>
            <EmptyDescription>
              Thêm nhà cung cấp AI để bắt đầu. Hỗ trợ OpenAI, Anthropic, Google,
              Groq và bất kỳ endpoint tương thích OpenAI.
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Thêm nhà cung cấp
          </Button>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      )}

      {addOpen && (
        <ProviderFormDialog open={addOpen} onOpenChange={setAddOpen} />
      )}
    </div>
  );
}
