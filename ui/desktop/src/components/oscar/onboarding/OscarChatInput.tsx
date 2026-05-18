import { useEffect, useRef, useState } from 'react';

interface Props {
  disabled: boolean;
  onSubmit: (text: string) => void;
  placeholder?: string;
}

export function OscarChatInput({ disabled, onSubmit, placeholder }: Props) {
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!disabled && taRef.current) {
      taRef.current.focus();
    }
  }, [disabled]);

  const submit = (): void => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <div className="oscar__chat-composer">
      <textarea
        ref={taRef}
        className="oscar__chat-input"
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? 'Type here…'}
        rows={1}
        onChange={(e) => {
          setValue(e.target.value);
          const ta = e.target as HTMLTextAreaElement;
          ta.style.height = 'auto';
          ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button
        type="button"
        className="oscar__chat-send"
        disabled={disabled || value.trim().length === 0}
        onClick={submit}
      >
        Send
      </button>
    </div>
  );
}
