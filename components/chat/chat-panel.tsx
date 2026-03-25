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
import { useChatPanel } from "@/lib/stores/chat-panel";
import { cn } from "@/lib/utils";
import { streamText } from "ai";
import {
  BotIcon,
  HistoryIcon,
  LoaderIcon,
  PlusIcon,
  SendIcon,
  SettingsIcon,
  SparklesIcon,
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
          model: getModel(selectedProvider, selectedModelId),
          messages: history,
          temperature,
          abortSignal: controller.signal,
        });

        let rawContent = "";
        let apiReasoning = "";

        for await (const part of result.fullStream) {
          if (part.type === "reasoning-delta") {
            apiReasoning += part.text;
          }
          if (part.type === "text-delta") {
            rawContent += part.text;
          }

          // Parse <think>/<thinking> tags from content stream
          const parsed = parseThinkingTags(rawContent);
          const combinedReasoning = apiReasoning
            ? apiReasoning + (parsed.reasoning ? "\n\n" + parsed.reasoning : "")
            : parsed.reasoning;

          setStreamingReasoning(combinedReasoning);
          setStreamingContent(parsed.content);
        }

        // Final parse
        const finalParsed = parseThinkingTags(rawContent);
        const finalReasoning = apiReasoning
          ? apiReasoning +
            (finalParsed.reasoning ? "\n\n" + finalParsed.reasoning : "")
          : finalParsed.reasoning;

        // Persist final content + reasoning
        await updateMessage(assistantMsgId, {
          content: finalParsed.content,
          ...(finalReasoning ? { reasoning: finalReasoning } : {}),
        });

        return { content: finalParsed.content, convoId };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (assistantMsgId) {
          const errorText =
            err instanceof Error ? err.message : "Không nhận được phản hồi";
          await updateMessage(assistantMsgId, {
            content: streamingContent || `Error: ${errorText}`,
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

  return (
    <div
      className={cn(
        "flex h-svh shrink-0 flex-col overflow-hidden border-l bg-card transition-[width] duration-200 ease-in-out sticky top-0",
        isOpen ? "w-[400px]" : "w-0",
      )}
    >
      <div
        className={cn(
          "flex h-full w-[400px] min-h-0 flex-col",
          isOpen ? "opacity-100 delay-100" : "opacity-0",
        )}
      >
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" />
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
            systemPrompt={systemPrompt}
            onSystemPromptChange={(p) =>
              updateChatSettings({ systemPrompt: p })
            }
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
                    <SparklesIcon />
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
      </div>
    </div>
  );
}
