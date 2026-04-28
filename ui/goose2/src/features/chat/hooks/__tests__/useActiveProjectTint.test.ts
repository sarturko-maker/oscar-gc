import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { useProjectStore } from "@/features/projects/stores/projectStore";

import { useActiveProjectTint } from "../useActiveProjectTint";

const baseSessionState = {
  sessions: [],
  activeSessionId: null,
  isLoading: false,
  hasHydratedSessions: true,
  contextPanelOpenBySession: {},
  activeWorkspaceBySession: {},
};

const baseProjectState = {
  projects: [],
  loading: false,
  activeProjectId: null,
};

describe("useActiveProjectTint", () => {
  beforeEach(() => {
    useChatSessionStore.setState(baseSessionState);
    useProjectStore.setState(baseProjectState);
  });

  it("returns null when there is no active session", () => {
    const { result } = renderHook(() => useActiveProjectTint());
    expect(result.current).toBeNull();
  });

  it("returns null when the active session has no projectId", () => {
    useChatSessionStore.setState({
      ...baseSessionState,
      sessions: [
        {
          id: "s1",
          title: "Chat",
          providerId: "openai",
          modelId: "gpt-4o",
          modelName: "GPT-4o",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
          messageCount: 0,
        },
      ],
      activeSessionId: "s1",
    });

    const { result } = renderHook(() => useActiveProjectTint());
    expect(result.current).toBeNull();
  });

  it("returns the project's color when the active session is in-project", () => {
    useProjectStore.setState({
      ...baseProjectState,
      projects: [
        {
          id: "p1",
          name: "Blue project",
          color: "#3b82f6",
          description: "",
          prompt: "",
          icon: "",
          preferredProvider: null,
          preferredModel: null,
          workingDirs: [],
          useWorktrees: false,
          order: 0,
          archivedAt: null,
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
          artifactsDir: "",
        },
      ],
    });
    useChatSessionStore.setState({
      ...baseSessionState,
      sessions: [
        {
          id: "s1",
          title: "Chat",
          providerId: "openai",
          modelId: "gpt-4o",
          modelName: "GPT-4o",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
          messageCount: 0,
          projectId: "p1",
        },
      ],
      activeSessionId: "s1",
    });

    const { result } = renderHook(() => useActiveProjectTint());
    expect(result.current).toBe("#3b82f6");
  });

  it("returns null when the active session references a deleted project", () => {
    useChatSessionStore.setState({
      ...baseSessionState,
      sessions: [
        {
          id: "s1",
          title: "Chat",
          providerId: "openai",
          modelId: "gpt-4o",
          modelName: "GPT-4o",
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z",
          messageCount: 0,
          projectId: "ghost-project",
        },
      ],
      activeSessionId: "s1",
    });

    const { result } = renderHook(() => useActiveProjectTint());
    expect(result.current).toBeNull();
  });
});
