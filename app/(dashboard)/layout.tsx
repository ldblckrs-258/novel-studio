"use client";

import { AppSidebar, miscNav, navConfig } from "@/components/app-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { DictInitializer } from "@/components/dict-initializer";
import { NameDictPanel } from "@/components/name-dict/name-dict-panel";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useChatPanel } from "@/lib/stores/chat-panel";
import { useNameDictPanel } from "@/lib/stores/name-dict-panel";
import { BookTextIcon, BotIcon, MoonIcon, SunIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const pageTitles: Record<string, string> = Object.fromEntries(
  [...navConfig, ...miscNav].map((item) => [item.href, item.title]),
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  let pageTitle = pageTitles[pathname] ?? "Novel Studio";
  if (pathname.match(/^\/novels\/[^/]+$/)) pageTitle = "Tiểu thuyết";
  if (pathname.match(/^\/novels\/[^/]+\/read$/)) pageTitle = "Đọc truyện";
  if (pathname.match(/^\/novels\/[^/]+\/chapters\/.+$/))
    pageTitle = "Soạn thảo";
  const novelIdMatch = pathname.match(/^\/novels\/([^/]+)/);
  const currentNovelId = novelIdMatch?.[1] ?? null;
  const toggleChat = useChatPanel((s) => s.toggle);
  const nameDictToggle = useNameDictPanel((s) => s.toggle);
  const nameDictSetNovelId = useNameDictPanel((s) => s.setNovelId);
  const toggleNameDict = () => nameDictToggle(currentNovelId);

  // Keep name dict panel's novelId in sync with URL
  useEffect(() => {
    nameDictSetNovelId(currentNovelId);
  }, [currentNovelId, nameDictSetNovelId]);

  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark =
      stored === "dark" ||
      (!stored && matchMedia("(prefers-color-scheme:dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);
  }, []);
  const toggleDark = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleDark}
              title="Chế độ sáng/tối"
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleNameDict}
              title="Từ điển tên"
            >
              <BookTextIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleChat}
              title="Bật/tắt AI Chat (⌘.)"
            >
              <BotIcon />
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </SidebarInset>
      <ChatPanel />
      <NameDictPanel />
      <DictInitializer />
    </SidebarProvider>
  );
}
