import { acpPrepareSession, acpSetModel } from "@/shared/api/acp";
import { useChatSessionStore } from "../stores/chatSessionStore";
import type { PreferredModelSelection } from "./useResolvedAgentModelPicker";

interface PrepareBoundSessionArgs {
  sessionId: string;
  providerId: string;
  workingDir: string;
  personaId?: string;
  projectId?: string | null;
  modelSelection?: PreferredModelSelection | null;
}

export async function prepareBoundSession({
  sessionId,
  providerId,
  workingDir,
  personaId,
  projectId,
  modelSelection,
}: PrepareBoundSessionArgs): Promise<void> {
  const sessionStore = useChatSessionStore.getState();
  const sessionBeforePrepare = sessionStore.getSession(sessionId);
  const gooseSessionId = await acpPrepareSession(
    sessionId,
    providerId,
    workingDir,
    {
      personaId,
      ...(projectId ? { projectId } : {}),
      ...(!sessionBeforePrepare?.acpSessionId ? { knownNew: true } : {}),
    },
  );
  if (
    gooseSessionId &&
    sessionStore.getSession(sessionId)?.acpSessionId !== gooseSessionId
  ) {
    sessionStore.updateSession(sessionId, { acpSessionId: gooseSessionId });
  }
  if (!modelSelection?.id) {
    return;
  }

  const liveSession = sessionStore.getSession(sessionId);
  const modelAlreadyApplied =
    Boolean(sessionBeforePrepare?.acpSessionId) &&
    liveSession?.modelId === modelSelection.id &&
    liveSession?.modelName === modelSelection.name;

  if (modelAlreadyApplied) {
    return;
  }

  await acpSetModel(sessionId, modelSelection.id);
  sessionStore.updateSession(sessionId, {
    modelId: modelSelection.id,
    modelName: modelSelection.name,
  });
}
