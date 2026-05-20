// Sprint 19 (ADR-066 D1, D3): single component, two visual variants.
// Onclick path: detach Top of Mind (so the last matter's snapshot doesn't
// bleed in) → ensure ~/Documents/Oscar GC/.quick-chats/ exists → start a
// session with no recipe (goose-server resolves extensions from
// config.yaml, so the lawyer's full permissive-default loadout is on per
// Sprint 18 / ADR-063) → dispatch ADD_ACTIVE_SESSION → navigate to /pair.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { createSession } from '../../../sessions';
import { AppEvents } from '../../../constants/events';

type QuickChatButtonVariant = 'sidebar' | 'hub';

interface QuickChatButtonProps {
  variant: QuickChatButtonVariant;
}

export default function QuickChatButton({ variant }: QuickChatButtonProps) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const startQuickChat = async (): Promise<void> => {
    if (starting) return;
    setStarting(true);
    try {
      await window.electron.matters.detachActive();
      const { path: quickChatsDir } =
        await window.electron.quickChats.ensureDir();
      const session = await createSession(quickChatsDir);
      window.dispatchEvent(
        new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
          detail: { sessionId: session.id, initialMessage: undefined },
        }),
      );
      navigate(`/pair?resumeSessionId=${encodeURIComponent(session.id)}`, {
        state: { disableAnimation: true },
      });
    } catch (err) {
      // Failures here are unusual (mkdir is recursive/idempotent; createSession
      // is straight HTTP). Log and reset; the user can retry the click.
      // eslint-disable-next-line no-console
      console.error('Quick chat start failed', err);
      setStarting(false);
    }
  };

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={() => void startQuickChat()}
        disabled={starting}
        className="oscar__sidebar-item oscar__sidebar-item--utility oscar__sidebar-item--quickchat"
        aria-label="Start a quick chat"
      >
        <Plus className="oscar__sidebar-item-icon" size={16} />
        {starting ? 'Starting…' : 'New chat'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void startQuickChat()}
      disabled={starting}
      className="oscar__button oscar__button--primary oscar__hub-cta"
    >
      {starting ? 'Starting…' : 'Start a quick chat'}
    </button>
  );
}
