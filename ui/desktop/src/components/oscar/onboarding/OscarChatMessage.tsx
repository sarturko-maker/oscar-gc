import type { Message } from '../../../api';
import { getTextAndImageContent } from '../../../types/message';

interface Props {
  label: string;
  body: string;
  variant: 'agent' | 'user';
  showCursor?: boolean;
}

export function OscarChatTurn({ label, body, variant, showCursor }: Props) {
  return (
    <div
      className={
        variant === 'user'
          ? 'oscar__chat-turn oscar__chat-turn--user'
          : 'oscar__chat-turn'
      }
    >
      <div className="oscar__chat-turn-label">{label}</div>
      <div className="oscar__chat-turn-body">
        {body}
        {showCursor && <span className="oscar__chat-cursor" aria-hidden="true" />}
      </div>
    </div>
  );
}

export function deriveTurnFromMessage(message: Message): {
  variant: 'agent' | 'user';
  label: string;
  body: string;
} {
  const { textContent } = getTextAndImageContent(message);
  return {
    variant: message.role === 'user' ? 'user' : 'agent',
    label: message.role === 'user' ? 'You //' : 'Oscar //',
    body: textContent,
  };
}
