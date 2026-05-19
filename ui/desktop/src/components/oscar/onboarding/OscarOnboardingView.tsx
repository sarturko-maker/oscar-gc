import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChatState } from '../../../types/chatState';
import { useChatStream } from '../../../hooks/useChatStream';
import { createSession } from '../../../sessions';
import { getInitialWorkingDir } from '../../../utils/workingDir';
import { errorMessage } from '../../../utils/conversionUtils';
import { GREETING } from './systemPrompt';
import { buildOnboardingRecipe } from './onboardingRecipe';
import { OscarChatTurn, deriveTurnFromMessage } from './OscarChatMessage';
import { OscarChatInput } from './OscarChatInput';

export default function OscarOnboardingView() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await createSession(getInitialWorkingDir(), {
          recipe: buildOnboardingRecipe({
            resourcesRoot: window.electron.oscarResourcesRoot,
          }),
        });
        if (mounted) setSessionId(session.id);
      } catch (err) {
        if (mounted) {
          setSessionError(errorMessage(err, 'Failed to start onboarding session'));
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (sessionError) {
    return (
      <div className="oscar oscar__chat-shell">
        <div className="oscar__eyebrow oscar__chat-shell-eyebrow">Oscar // Onboarding</div>
        <OscarChatTurn label="Oscar //" body={GREETING} variant="agent" />
        <div className="oscar__chat-status oscar__chat-status--error">
          Could not start: {sessionError}
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="oscar oscar__chat-shell">
        <div className="oscar__eyebrow oscar__chat-shell-eyebrow">Oscar // Onboarding</div>
        <OscarChatTurn label="Oscar //" body={GREETING} variant="agent" />
        <div className="oscar__chat-status">Loading…</div>
      </div>
    );
  }

  return <OscarOnboardingChat sessionId={sessionId} />;
}

function OscarOnboardingChat({ sessionId }: { sessionId: string }) {
  const { messages, chatState, handleSubmit } = useChatStream({
    sessionId,
    onStreamFinish: () => {
      /* The OscarOnboardingGuard polls the profile file and routes away
         once finalize_profile lands on disk. Nothing to do here. */
    },
  });

  const isStreaming =
    chatState !== ChatState.Idle && chatState !== ChatState.WaitingForUserInput;

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = transcriptRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isStreaming]);

  return (
    <div className="oscar oscar__chat-shell">
      <div className="oscar__eyebrow oscar__chat-shell-eyebrow">Oscar // Onboarding</div>
      <div className="oscar__chat-transcript" ref={transcriptRef}>
        <OscarChatTurn label="Oscar //" body={GREETING} variant="agent" />
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const showCursor = isLast && m.role === 'assistant' && isStreaming;
          const turn = deriveTurnFromMessage(m);
          if (!turn.body && !showCursor) {
            return null;
          }
          return (
            <OscarChatTurn
              key={m.id}
              label={turn.label}
              body={turn.body}
              variant={turn.variant}
              showCursor={showCursor}
            />
          );
        })}
      </div>
      <OscarChatInput
        disabled={isStreaming}
        onSubmit={(text) => {
          void handleSubmit({ msg: text, images: [] });
        }}
      />
    </div>
  );
}
