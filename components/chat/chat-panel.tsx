"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildErrorTrace, storeErrorTrace } from "@/lib/ai/error-trace";
import { getModel } from "@/lib/ai/provider";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import {
  addMessage,
  createConversation,
  deleteConversation,
  deleteMessagesFrom,
  updateChatSettings,
  updateConversation,
  updateMessage,
  useAIModels,
  useAIProviders,
  useChatSettings,
  useConversationMessages,
  useConversations,
} from "@/lib/hooks";
import { useChapterTools } from "@/lib/stores/chapter-tools";
import { useChatPanel } from "@/lib/stores/chat-panel";
import { cn } from "@/lib/utils";
import { APICallError, streamText } from "ai";
import {
  BotIcon,
  HistoryIcon,
  LoaderIcon,
  PlusIcon,
  SendIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { ChatHistoryDialog } from "./chat-history-dialog";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import { MessageBubble } from "./message-bubble";
import { ScrollToBottom } from "./scroll-to-bottom";
import { parseThinkingTags } from "./thinking-parser";

export function ChatPanel() {
  const { isOpen, close, activeConversationId, setActiveConversation } =
    useChatPanel();
  const toolActive = useChapterTools((s) => s.activeMode !== null);
  const isMobile = useIsMobile();

  const providers = useAIProviders();
  const chatSettings = useChatSettings();
  const selectedProviderId = chatSettings.providerId;
  const selectedModelId = chatSettings.modelId;
  const systemPrompt =
    withGlobalInstruction(
      chatSettings.systemPrompt,
      chatSettings.globalSystemInstruction,
    ) ?? "";
  const temperature = chatSettings.temperature;
  const selectedProvider = providers?.find((p) => p.id === selectedProviderId);
  const models = useAIModels(selectedProviderId || undefined);

  const conversations = useConversations();
  const dbMessages = useConversationMessages(activeConversationId ?? undefined);

  const [streamingContent, setStreamingContent] = useState<string>("");
  const [streamingReasoning, setStreamingReasoning] = useState<string>("");
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  // Auto-select first provider when none is set
  useEffect(() => {
    if (providers?.length && !selectedProviderId) {
      updateChatSettings({ providerId: providers[0].id });
    }
  }, [providers, selectedProviderId]);

  // Auto-select first model when none is set
  useEffect(() => {
    if (models?.length && !selectedModelId) {
      updateChatSettings({ modelId: models[0].modelId });
    }
  }, [models, selectedModelId]);

  // Sync provider/model when user switches to a different conversation
  const prevConvoIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      activeConversationId &&
      activeConversationId !== prevConvoIdRef.current
    ) {
      const convo = conversations?.find((c) => c.id === activeConversationId);
      if (convo) {
        updateChatSettings({
          providerId: convo.providerId,
          modelId: convo.modelId,
        });
      }
    }
    prevConvoIdRef.current = activeConversationId;
  }, [activeConversationId, conversations]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Keyboard shortcut: Cmd+. to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "." && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        useChatPanel.getState().toggle();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /** Core: send a user message in a conversation and stream the response. */
  const sendAndStream = useCallback(
    async (convoId: string, userText: string) => {
      if (!selectedProvider || !selectedModelId) return;

      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      let assistantMsgId: string | null = null;

      try {
        // Save user message
        await addMessage({
          conversationId: convoId,
          role: "user",
          content: userText,
        });

        // Create placeholder assistant message
        assistantMsgId = await addMessage({
          conversationId: convoId,
          role: "assistant",
          content: "",
        });
        setStreamingMsgId(assistantMsgId);
        setStreamingContent("");
        setStreamingReasoning("");

        // Build conversation history from DB
        const currentMessages = await import("@/lib/db").then((mod) =>
          mod.db.conversationMessages
            .where("conversationId")
            .equals(convoId)
            .sortBy("createdAt"),
        );

        const history = [
          {
            role: "system" as const,
            content: systemPrompt,
          },
          ...currentMessages
            .filter((m) => m.id !== assistantMsgId)
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
        ];

        const result = streamText({
          model: await getModel(selectedProvider, selectedModelId),
          messages: history,
          temperature,
          abortSignal: controller.signal,
        });

        let rawContent = "";
        let apiReasoning = "";
        let finishReason: string | undefined;
        let streamError: unknown = null;

        for await (const part of result.fullStream) {
          if (part.type === "reasoning-delta") {
            apiReasoning += part.text;
          }
          if (part.type === "text-delta") {
            rawContent += part.text;
          }
          if (part.type === "finish-step") {
            finishReason = part.finishReason;
          }
          if (part.type === "error") {
            streamError = part.error;
          }

          // Parse <think>/<thinking> tags from content stream
          const parsed = parseThinkingTags(rawContent);
          const combinedReasoning = apiReasoning
            ? apiReasoning + (parsed.reasoning ? "\n\n" + parsed.reasoning : "")
            : parsed.reasoning;

          setStreamingReasoning(combinedReasoning);
          setStreamingContent(parsed.content);
        }

        // If stream emitted an error part (network failures, API errors, etc.),
        // throw so the catch block can format it properly
        if (streamError) {
          throw streamError;
        }

        // Final parse
        const finalParsed = parseThinkingTags(rawContent);
        const finalReasoning = apiReasoning
          ? apiReasoning +
            (finalParsed.reasoning ? "\n\n" + finalParsed.reasoning : "")
          : finalParsed.reasoning;

        // Empty response — provide specific message based on finish reason
        let finalContent = finalParsed.content;
        if (!finalContent.trim()) {
          if (finishReason === "content-filter") {
            finalContent =
              "<!-- error -->\n**Nội dung bị chặn** — Bộ lọc an toàn của nhà cung cấp AI đã chặn phản hồi này. Hãy thử chỉnh sửa **Chỉ thị chung**, **system prompt** của cuộc hội thoại, hoặc **đổi mô hình AI** khác.";
          } else if (finishReason === "length") {
            finalContent =
              "<!-- error -->\n**Vượt quá giới hạn token** — Phản hồi đã bị cắt do vượt quá giới hạn token của mô hình. Hãy thử rút ngắn lịch sử hội thoại hoặc sử dụng mô hình có context lớn hơn.";
          } else if (finishReason === "error") {
            finalContent =
              "<!-- error -->\n**Lỗi nhà cung cấp** — Nhà cung cấp AI gặp lỗi nội bộ khi xử lý yêu cầu. Hãy thử lại sau hoặc đổi mô hình AI khác.";
          } else {
            finalContent =
              "<!-- error -->\n**Phản hồi trống** — Nhà cung cấp AI trả về nội dung trống (finish reason: `" +
              (finishReason || "unknown") +
              "`). Hãy thử chỉnh sửa **Chỉ thị chung**, **system prompt** của cuộc hội thoại, hoặc **đổi mô hình AI** khác.";
          }

          // Store trace for empty/error responses too
          if (assistantMsgId) {
            const emptyErr = new Error(
              `Empty response (finish reason: ${finishReason || "unknown"})`,
            );
            const trace = buildErrorTrace(emptyErr, {
              module: "chat",
              provider: {
                name: selectedProvider.name,
                type: selectedProvider.providerType ?? "openai-compatible",
                baseUrl: selectedProvider.baseUrl,
              },
              modelId: selectedModelId,
              request: {
                systemPrompt,
                messageCount: history.length,
                temperature,
                lastUserMessage: userText,
              },
            });
            storeErrorTrace(assistantMsgId, trace);
          }
        }

        // Persist final content + reasoning
        await updateMessage(assistantMsgId, {
          content: finalContent,
          ...(finalReasoning ? { reasoning: finalReasoning } : {}),
        });

        return { content: finalContent, convoId };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (assistantMsgId) {
          let errorContent: string;

          if (APICallError.isInstance(err)) {
            const status = err.statusCode;
            const body = err.responseBody;

            // Extract human-readable message from response body.
            // Some providers nest JSON inside error.message (upstream proxies),
            // so we recurse one level to find a plain-text message.
            let detail = "";
            let bodyJson = "";
            if (body) {
              try {
                const parsed = JSON.parse(body);
                bodyJson = JSON.stringify(parsed, null, 2);

                const extractMessage = (obj: unknown): string => {
                  if (!obj || typeof obj !== "object") return "";
                  const o = obj as Record<string, unknown>;
                  const msg =
                    (typeof o?.error === "object"
                      ? (o.error as Record<string, unknown>)?.message
                      : undefined) ??
                    o?.message ??
                    (typeof o?.error === "string" ? o.error : "");
                  if (typeof msg !== "string") return "";
                  // If the message itself is JSON, try to extract from it
                  const trimmed = msg.trim();
                  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    try {
                      return extractMessage(JSON.parse(trimmed));
                    } catch {
                      /* not JSON, use as-is */
                    }
                  }
                  return msg;
                };

                detail = extractMessage(parsed);
              } catch {
                detail = body.length > 200 ? body.slice(0, 200) + "..." : body;
              }
            }

            const responseBlock = bodyJson
              ? `\n\n\`\`\`json\n${bodyJson}\n\`\`\``
              : "";

            if (status === 401 || status === 403) {
              errorContent = `<!-- error -->\n**Lỗi xác thực (${status})** — ${detail || "API key không hợp lệ hoặc không có quyền truy cập."}\n\nHãy kiểm tra lại API key trong **Cài đặt nhà cung cấp AI**.${responseBlock}`;
            } else if (status === 429) {
              errorContent = `<!-- error -->\n**Vượt quá giới hạn (429)** — ${detail || "Đã vượt quá rate limit hoặc hết quota."}\n\nHãy chờ một lát rồi thử lại, hoặc kiểm tra quota tài khoản.${responseBlock}`;
            } else if (status === 404) {
              errorContent = `<!-- error -->\n**Không tìm thấy (404)** — ${detail || "Mô hình hoặc endpoint không tồn tại."}\n\nHãy kiểm tra lại tên mô hình và URL của nhà cung cấp.${responseBlock}`;
            } else if (status && status >= 500) {
              errorContent = `<!-- error -->\n**Lỗi server (${status})** — ${detail || "Nhà cung cấp AI gặp sự cố nội bộ."}\n\nHãy thử lại sau.${responseBlock}`;
            } else {
              errorContent = `<!-- error -->\n**Lỗi API${status ? ` (${status})` : ""}** — ${detail || "Yêu cầu không hợp lệ."}${responseBlock}`;
            }
          } else {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const cause =
              err instanceof Error && err.cause instanceof Error
                ? err.cause.message
                : "";
            errorContent = `<!-- error -->\n**Lỗi kết nối** — ${errorMsg}${cause ? `\n\n> ${cause}` : ""}`;
          }

          // Build and store error trace for debug download
          const trace = buildErrorTrace(err, {
            module: "chat",
            provider: {
              name: selectedProvider.name,
              type: selectedProvider.providerType ?? "openai-compatible",
              baseUrl: selectedProvider.baseUrl,
            },
            modelId: selectedModelId,
            request: {
              systemPrompt,
              messageCount: history.length,
              temperature,
              lastUserMessage: userText,
            },
          });
          storeErrorTrace(assistantMsgId, trace);

          await updateMessage(assistantMsgId, {
            content: streamingContent || errorContent,
          });
        }
      } finally {
        setIsStreaming(false);
        setStreamingMsgId(null);
        setStreamingContent("");
        setStreamingReasoning("");
        abortRef.current = null;
      }
    },
    [
      selectedProvider,
      selectedModelId,
      streamingContent,
      systemPrompt,
      temperature,
    ],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !selectedProvider || !selectedModelId) return;

    setInput("");

    // Create or reuse conversation
    let convoId = activeConversationId;
    if (!convoId) {
      const title = text.length > 50 ? text.slice(0, 47) + "..." : text;
      convoId = await createConversation({
        title,
        providerId: selectedProviderId,
        modelId: selectedModelId,
      });
      setActiveConversation(convoId);
    }

    const result = await sendAndStream(convoId, text);

    // Auto-title from first assistant reply
    if (!activeConversationId && result?.content) {
      const shortTitle =
        result.content.length > 60
          ? result.content.slice(0, 57) + "..."
          : result.content;
      await updateConversation(convoId, {
        title: shortTitle || text.slice(0, 50),
      });
    }
  }, [
    input,
    isStreaming,
    selectedProvider,
    selectedProviderId,
    selectedModelId,
    activeConversationId,
    setActiveConversation,
    sendAndStream,
  ]);

  /** Edit a user message: delete it and everything after, then resend with new text. */
  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (isStreaming || !activeConversationId) return;
      await deleteMessagesFrom(activeConversationId, messageId);
      await sendAndStream(activeConversationId, newContent);
    },
    [isStreaming, activeConversationId, sendAndStream],
  );

  /** Rerun a user message: delete it and its response, then resend the same text. */
  const handleRerunMessage = useCallback(
    async (messageId: string, content: string) => {
      if (isStreaming || !activeConversationId) return;
      await deleteMessagesFrom(activeConversationId, messageId);
      await sendAndStream(activeConversationId, content);
    },
    [isStreaming, activeConversationId, sendAndStream],
  );

  function handleStop() {
    abortRef.current?.abort();
  }

  async function handleNewConversation() {
    if (isStreaming) handleStop();
    setActiveConversation(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const hasProvider = providers && providers.length > 0;
  const hasModels = models && models.length > 0;
  const canSend = !!input.trim() && hasProvider && hasModels && !isStreaming;

  // Merge DB messages with in-progress streaming
  const displayMessages = (dbMessages ?? []).map((m) =>
    m.id === streamingMsgId
      ? {
          ...m,
          ...(streamingContent ? { content: streamingContent } : {}),
          ...(streamingReasoning ? { reasoning: streamingReasoning } : {}),
        }
      : m,
  );

  const panelContent = (
    <>
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <BotIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Trò chuyện AI</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleNewConversation}
            title="Cuộc trò chuyện mới"
          >
            <PlusIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setHistoryOpen(true)}
            title="Lịch sử trò chuyện"
          >
            <HistoryIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setSettingsOpen(true)}
            title="Cài đặt trò chuyện"
          >
            <SettingsIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={close}>
            <XIcon />
          </Button>
        </div>
      </div>

      {historyOpen && (
        <ChatHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          conversations={conversations ?? []}
          activeConversationId={activeConversationId}
          onSelect={(id) => {
            setActiveConversation(id);
            setHistoryOpen(false);
          }}
          onDelete={async (id) => {
            await deleteConversation(id);
            if (activeConversationId === id) setActiveConversation(null);
          }}
        />
      )}

      {settingsOpen && (
        <ChatSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          providers={providers ?? []}
          models={models ?? []}
          selectedProviderId={selectedProviderId}
          onProviderChange={(id) =>
            updateChatSettings({ providerId: id, modelId: "" })
          }
          selectedModelId={selectedModelId}
          onModelChange={(id) => updateChatSettings({ modelId: id })}
          systemPrompt={chatSettings.systemPrompt ?? ""}
          onSystemPromptChange={(p) => updateChatSettings({ systemPrompt: p })}
          temperature={temperature}
          onTemperatureChange={(t) => updateChatSettings({ temperature: t })}
        />
      )}

      {/* Messages */}
      <StickToBottom
        className="relative min-h-0 flex-1"
        resize="smooth"
        initial="instant"
      >
        <StickToBottom.Content className="flex flex-col gap-4 p-4">
          {!hasProvider ? (
            <Empty className="my-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BotIcon />
                </EmptyMedia>
                <EmptyTitle>Chưa cấu hình nhà cung cấp AI</EmptyTitle>
                <EmptyDescription>
                  Thêm nhà cung cấp trong Cài đặt để bắt đầu trò chuyện.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : displayMessages.length === 0 ? (
            <Empty className="my-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BotIcon />
                </EmptyMedia>
                <EmptyTitle>Trợ lý sáng tác</EmptyTitle>
                <EmptyDescription>
                  Đặt câu hỏi, brainstorm ý tưởng, hoặc nhận trợ giúp với bài
                  viết của bạn.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            displayMessages
              .filter((m) => m.role !== "system")
              .map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming && msg.id === streamingMsgId}
                  onEdit={
                    msg.role === "user" && !isStreaming
                      ? (newContent) => handleEditMessage(msg.id, newContent)
                      : undefined
                  }
                  onRerun={
                    msg.role === "user" && !isStreaming
                      ? () => handleRerunMessage(msg.id, msg.content)
                      : undefined
                  }
                />
              ))
          )}
          {isStreaming && !streamingContent && !streamingReasoning && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderIcon className="size-3 animate-spin" />
              Đang suy nghĩ...
            </div>
          )}
        </StickToBottom.Content>
        <ScrollToBottom />
      </StickToBottom>

      {/* Input */}
      <div className="shrink-0 border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasProvider
                ? "Hỏi trợ lý sáng tác..."
                : "Vui lòng cấu hình nhà cung cấp trước"
            }
            disabled={!hasProvider || !hasModels}
            rows={1}
            className="field-sizing-content max-h-32 min-h-8 flex-1 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          {isStreaming ? (
            <Button
              size="icon"
              variant="outline"
              onClick={handleStop}
              title="Dừng tạo"
            >
              <XIcon />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              title="Gửi tin nhắn"
            >
              <SendIcon />
            </Button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <NativeSelect
            size="sm"
            className="max-w-[160px] *:text-[11px]!"
            value={selectedModelId}
            onChange={(e) => updateChatSettings({ modelId: e.target.value })}
            disabled={!hasModels || isStreaming}
          >
            {!hasModels && (
              <NativeSelectOption value="">Không có model</NativeSelectOption>
            )}
            {models?.map((m) => (
              <NativeSelectOption key={m.id} value={m.modelId}>
                {m.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="text-[10px] text-muted-foreground/60">
            <kbd className="font-mono">Shift+Enter</kbd> dòng mới
          </span>
        </div>
      </div>
    </>
  );

  // Mobile: Sheet drawer
  if (isMobile) {
    return (
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-[85vw] bg-card p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Trò chuyện AI</SheetTitle>
            <SheetDescription>Bảng trò chuyện AI</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{panelContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: normal panel when no tool active, floating overlay when tool is open
  if (toolActive) {
    return (
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-20 hidden h-svh w-[400px] border-l bg-card shadow-lg transition-[right] duration-200 ease-linear md:flex",
          !isOpen && "right-[calc(400px*-1)]",
        )}
      >
        <div className="flex size-full flex-col">{panelContent}</div>
      </div>
    );
  }

  // No tool active — normal layout panel with gap spacer
  return (
    <div className="hidden md:block">
      <div
        className={cn(
          "relative bg-transparent transition-[width] duration-200 ease-linear",
          isOpen ? "w-[360px]" : "w-0",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-10 hidden h-svh w-[360px] border-l bg-card transition-[right] duration-200 ease-linear md:flex",
          !isOpen && "right-[calc(360px*-1)]",
        )}
      >
        <div className="flex size-full flex-col">{panelContent}</div>
      </div>
    </div>
  );
}
