"use client";

import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useNovels } from "@/lib/hooks";
import { useQTEngineStatus } from "@/lib/hooks/use-qt-engine";
import {
  BookOpenIcon,
  DatabaseIcon,
  GitCompareArrowsIcon,
  HistoryIcon,
  HomeIcon,
  LibraryIcon,
  LoaderIcon,
  PenLineIcon,
  ScrollTextIcon,
  ServerIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const navConfig = [
  { title: "Trang chủ", href: "/", icon: HomeIcon },
  { title: "Thư viện", href: "/library", icon: LibraryIcon },
  { title: "Nhập sách", href: "/import", icon: UploadIcon },
  { title: "Convert nhanh", href: "/convert", icon: GitCompareArrowsIcon },
  { title: "Nhà cung cấp AI", href: "/settings/providers", icon: ServerIcon },
  {
    title: "Chỉ thị chung",
    href: "/settings/instructions",
    icon: ScrollTextIcon,
  },
  {
    title: "Quản lý dữ liệu",
    href: "/settings/data",
    icon: DatabaseIcon,
  },
] as const;

export const miscNav = [
  { title: "Nhật ký thay đổi", href: "/changelog", icon: HistoryIcon },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const novels = useNovels();
  const recentNovels = novels?.slice(0, 5);

  const mainNav = navConfig.filter(
    (item) => !item.href.startsWith("/settings"),
  );
  const settingsNav = navConfig.filter((item) =>
    item.href.startsWith("/settings"),
  );

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar">
      <SidebarHeader className="px-3 py-4">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
            <PenLineIcon className="size-4 text-sidebar-accent-foreground" />
          </div>
          <div className="flex flex-col gap-0 leading-none">
            <span className="font-heading text-[15px] font-semibold tracking-tight text-sidebar-foreground">
              Novel Studio
            </span>
            <span className="text-[11px] text-sidebar-foreground/50">
              Không gian sáng tác
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Điều hướng</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tiểu thuyết gần đây</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recentNovels && recentNovels.length > 0 ? (
                recentNovels.map((novel) => (
                  <SidebarMenuItem key={novel.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/novels/${novel.id}`}
                      tooltip={novel.title}
                    >
                      <Link href={`/novels/${novel.id}`}>
                        <BookOpenIcon />
                        <span className="truncate">{novel.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Chưa có tiểu thuyết"
                    className="text-sidebar-foreground/60"
                  >
                    <BookOpenIcon />
                    <span className="italic">Chưa có tiểu thuyết</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Cài đặt</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Khác</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {miscNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <DictLoadingFooter />
      <SidebarRail />
    </Sidebar>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  names: "Names",
  names2: "Names2",
  phienam: "Phiên âm",
  luatnhan: "Luật nhân",
  vietphrase: "VietPhrase",
};

function DictLoadingFooter() {
  const { phase, loadingSource, loadingPercent } = useQTEngineStatus();

  if (phase === "idle" || phase === "ready") return null;

  return (
    <SidebarFooter className="border-t px-3 py-2">
      {phase === "error" ? (
        <p className="text-xs text-red-500">Lỗi tải từ điển</p>
      ) : (
        <div className="space-y-1.5">
          {phase === "loading" && (
            <Progress value={loadingPercent} className="h-1.5" />
          )}
          <div className="flex items-center gap-2">
            <LoaderIcon className="size-3.5 shrink-0 animate-spin text-blue-500" />
            <span className="text-xs text-sidebar-foreground/70">
              {phase === "loading"
                ? `Đang tải ${SOURCE_LABELS[loadingSource] ?? loadingSource}...`
                : "Đang khởi tạo engine..."}
            </span>
            <span className="ml-auto text-xs text-sidebar-foreground/50">
              {phase === "loading" ? `${loadingPercent}%` : null}
            </span>
          </div>
        </div>
      )}
    </SidebarFooter>
  );
}
