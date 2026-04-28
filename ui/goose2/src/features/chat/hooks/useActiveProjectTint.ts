import { useChatSessionStore } from "@/features/chat/stores/chatSessionStore";
import { useProjectStore } from "@/features/projects/stores/projectStore";

/**
 * Resolves the active chat session's project color. Returns the hex string
 * if the active session is bound to a known project, otherwise null. The
 * route gate (only-tint-when-on-chat-view) lives at the application point
 * in AppShell, not here — this hook stays a pure session→project→color
 * selector so it has one named place to test.
 */
export function useActiveProjectTint(): string | null {
  const activeSessionId = useChatSessionStore((s) => s.activeSessionId);
  const sessions = useChatSessionStore((s) => s.sessions);
  const projects = useProjectStore((s) => s.projects);

  if (!activeSessionId) return null;
  const session = sessions.find((s) => s.id === activeSessionId);
  if (!session?.projectId) return null;
  const project = projects.find((p) => p.id === session.projectId);
  return project?.color ?? null;
}
