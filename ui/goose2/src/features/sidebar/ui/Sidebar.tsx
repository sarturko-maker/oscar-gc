import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Bot, History, Home } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { AppView } from "@/app/types";
import type { ProjectInfo } from "@/features/projects/api/projects";
import { useChatStore } from "@/features/chat/stores/chatStore";
import {
  getVisibleSessions,
  useChatSessionStore,
} from "@/features/chat/stores/chatSessionStore";
import { isSessionRunning } from "@/features/chat/lib/sessionActivity";
import { SidebarProjectsSection } from "./SidebarProjectsSection";
import { useSidebarHighlight } from "./useSidebarHighlight";

interface SidebarProps {
  collapsed: boolean;
  width?: number;
  isResizing?: boolean;
  onNewChatInProject?: (projectId: string) => void;
  onNewChat?: () => void;
  onCreateProject?: () => void;
  onEditProject?: (projectId: string) => void;
  onArchiveProject?: (projectId: string) => void;
  onArchiveChat?: (sessionId: string) => void;
  onRenameChat?: (sessionId: string, nextTitle: string) => void;
  onMoveToProject?: (sessionId: string, projectId: string | null) => void;
  onReorderProject?: (fromId: string, toId: string) => void;
  onNavigate?: (view: AppView) => void;
  onSelectSession?: (sessionId: string) => void;
  activeView?: AppView;
  activeSessionId?: string | null;
  className?: string;
  projects: ProjectInfo[];
}

const EXPANDED_PROJECTS_STORAGE_KEY = "goose:sidebar:expanded-projects";

export function Sidebar({
  collapsed,
  width = 240,
  isResizing = false,
  onNewChatInProject,
  onNewChat,
  onCreateProject,
  onEditProject,
  onArchiveProject,
  onArchiveChat,
  onRenameChat,
  onMoveToProject,
  onReorderProject,
  onNavigate,
  onSelectSession,
  activeView,
  activeSessionId,
  className,
  projects,
}: SidebarProps) {
  const { t } = useTranslation("sidebar");
  const [expanded, setExpanded] = useState(!collapsed);
  const prevCollapsed = useRef(collapsed);
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem(EXPANDED_PROJECTS_STORAGE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const chatStore = useChatStore();
  const { sessions } = useChatSessionStore();
  const visibleSessions = getVisibleSessions(
    sessions,
    chatStore.messagesBySession,
  );
  useEffect(() => {
    if (collapsed) {
      setExpanded(false);
    } else if (prevCollapsed.current && !collapsed) {
      const timer = setTimeout(() => setExpanded(true), 60);
      return () => clearTimeout(timer);
    } else {
      setExpanded(true);
    }
    prevCollapsed.current = collapsed;
  }, [collapsed]);

  const labelTransition = "transition-[opacity,width] duration-300 ease-out";
  const labelVisible = expanded && !collapsed;
  const navItems: readonly { id: AppView; label: string; icon: typeof Bot }[] =
    [
      { id: "agents", label: t("navigation.agents"), icon: Bot },
      { id: "skills", label: t("navigation.skills"), icon: BookOpen },
      {
        id: "session-history",
        label: t("navigation.sessionHistory"),
        icon: History,
      },
    ];

  const MAX_RECENTS = 20;
  const validProjectIds = new Set(projects.map((project) => project.id));

  const projectSessions = (() => {
    type SessionItem = {
      id: string;
      title: string;
      sessionId: string;
      projectId?: string;
      updatedAt: string;
      isRunning: boolean;
      hasUnread: boolean;
    };
    const byProject: Record<string, SessionItem[]> = {};
    const standalone: SessionItem[] = [];
    for (const session of visibleSessions) {
      if (session.archivedAt) continue;
      const runtime = chatStore.getSessionRuntime(session.id);
      const item: SessionItem = {
        id: session.id,
        title: session.title,
        sessionId: session.id,
        projectId: session.projectId ?? undefined,
        updatedAt: session.updatedAt,
        isRunning: isSessionRunning(runtime.chatState),
        hasUnread: runtime.hasUnread,
      };
      if (session.projectId && validProjectIds.has(session.projectId)) {
        if (!byProject[session.projectId]) byProject[session.projectId] = [];
        byProject[session.projectId].push(item);
      } else {
        standalone.push(item);
      }
    }
    for (const chats of Object.values(byProject)) {
      chats.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    standalone.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const limitedStandalone = standalone.slice(0, MAX_RECENTS);
    return { byProject, standalone: limitedStandalone };
  })();

  useEffect(() => {
    if (!activeSessionId) return;
    const activeSession = visibleSessions.find((s) => s.id === activeSessionId);
    const projectId = activeSession?.projectId;
    if (projectId) {
      setExpandedProjects((prev) => {
        if (prev[projectId]) return prev;
        return { ...prev, [projectId]: true };
      });
    }
  }, [activeSessionId, visibleSessions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        EXPANDED_PROJECTS_STORAGE_KEY,
        JSON.stringify(expandedProjects),
      );
    } catch {
      // localStorage may be unavailable
    }
  }, [expandedProjects]);

  useEffect(() => {
    if (projects.length === 0) return;
    const validProjectIds = new Set(projects.map((project) => project.id));
    setExpandedProjects((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([projectId]) =>
          validProjectIds.has(projectId),
        ),
      );
      return Object.keys(next).length === Object.keys(prev).length
        ? prev
        : next;
    });
  }, [projects]);

  const toggleProject = (projectId: string) =>
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));

  const navRef = useRef<HTMLElement>(null);
  const homeRef = useRef<HTMLButtonElement>(null);
  const navItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const {
    currentRect,
    isHovering,
    isResizing: isHighlightResizing,
    onItemMouseEnter,
    onNavMouseLeave,
    updateActiveRect,
  } = useSidebarHighlight(navRef);

  const activeProjectId =
    activeSessionId && activeView === "chat"
      ? (sessions.find((s) => s.id === activeSessionId)?.projectId ?? null)
      : null;

  useEffect(() => {
    if (activeSessionId && activeView === "chat") return;
    if (activeView === "home") {
      updateActiveRect(homeRef.current);
    } else if (activeView && navItemRefs.current[activeView]) {
      updateActiveRect(navItemRefs.current[activeView]);
    } else {
      updateActiveRect(null);
    }
  }, [activeSessionId, activeView, updateActiveRect]);

  const activeSessionRefCallback = useCallback(
    (el: HTMLElement | null) => {
      if (activeSessionId && el) updateActiveRect(el);
    },
    [activeSessionId, updateActiveRect],
  );
  const activeProjectRefCallback = useCallback(
    (el: HTMLElement | null) => {
      if (activeProjectId && el) updateActiveRect(el);
    },
    [activeProjectId, updateActiveRect],
  );

  return (
    <div
      className={cn(
        "relative h-3/4 max-h-full",
        !isResizing && "transition-[width] duration-300 ease-in-out",
        className,
      )}
      style={{ width }}
    >
      <div
        className="flex h-full flex-col overflow-hidden rounded-chrome bg-[var(--surface-chrome)] backdrop-blur-md [--muted-foreground:var(--text-muted-alex)]"
        style={{
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <nav
          ref={navRef}
          className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1.5 pb-5 pt-5 scrollbar-none"
          onMouseLeave={onNavMouseLeave}
        >
          {currentRect && (
            <div
              className="absolute left-1.5 right-1.5 rounded-lg bg-accent/50 pointer-events-none z-0"
              style={{
                top: currentRect.top,
                height: currentRect.height,
                transition:
                  isHovering || isHighlightResizing
                    ? "top 0ms, height 0ms"
                    : "top 200ms ease, height 200ms ease, opacity 200ms ease",
              }}
            />
          )}

          <div className="relative z-10 space-y-0.5">
            <button
              ref={homeRef}
              type="button"
              data-testid="nav-home"
              onClick={() => onNavigate?.("home")}
              onMouseEnter={onItemMouseEnter}
              aria-label={t("navigation.home")}
              className={cn(
                "flex items-center w-full text-[13px] font-light transition-colors duration-200 rounded-md",
                "gap-2 px-3 py-2",
                activeView === "home"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Home className="size-4 flex-shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap",
                  labelTransition,
                  labelVisible
                    ? "opacity-100 w-auto"
                    : "opacity-0 w-0 overflow-hidden",
                )}
              >
                {t("navigation.home")}
              </span>
            </button>

            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    navItemRefs.current[item.id] = el;
                  }}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  onMouseEnter={onItemMouseEnter}
                  className={cn(
                    "flex items-center w-full text-[13px] font-light transition-colors duration-200 rounded-md",
                    "gap-2 px-3 py-2",
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    transitionDelay:
                      !collapsed && expanded ? `${index * 30}ms` : "0ms",
                  }}
                >
                  <Icon className="size-4 flex-shrink-0" />
                  <span
                    className={cn(
                      "whitespace-nowrap",
                      labelTransition,
                      labelVisible
                        ? "opacity-100 w-auto"
                        : "opacity-0 w-0 overflow-hidden",
                    )}
                    style={{
                      transitionDelay: labelVisible
                        ? `${index * 30 + 60}ms`
                        : "0ms",
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          <SidebarProjectsSection
            projects={projects}
            projectSessions={projectSessions}
            expandedProjects={expandedProjects}
            toggleProject={toggleProject}
            collapsed={collapsed}
            labelTransition={labelTransition}
            labelVisible={labelVisible}
            activeSessionId={activeSessionId}
            activeProjectId={activeProjectId}
            onNavigate={onNavigate}
            onSelectSession={onSelectSession}
            onNewChatInProject={onNewChatInProject}
            onNewChat={onNewChat}
            onCreateProject={onCreateProject}
            onEditProject={onEditProject}
            onArchiveProject={onArchiveProject}
            onArchiveChat={onArchiveChat}
            onRenameChat={onRenameChat}
            onMoveToProject={onMoveToProject}
            onReorderProject={onReorderProject}
            onItemMouseEnter={onItemMouseEnter}
            activeSessionRefCallback={activeSessionRefCallback}
            activeProjectRefCallback={activeProjectRefCallback}
          />
        </nav>
      </div>
    </div>
  );
}
