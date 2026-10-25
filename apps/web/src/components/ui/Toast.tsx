import * as RadixToast from '@radix-ui/react-toast';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tone = 'info' | 'error' | 'success';
interface ToastMessage {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const toneClass: Record<Tone, string> = {
  info: 'bg-text text-surface',
  error: 'bg-error text-white',
  success: 'bg-success text-white',
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const show = useCallback((text: string, tone: Tone = 'info') => {
    setMessages((list) => [...list, { id: nextId++, text, tone }]);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      <RadixToast.Provider duration={5000}>
        {children}
        {messages.map((m) => (
          <RadixToast.Root
            key={m.id}
            className={`rounded px-4 py-2 shadow-lg ${toneClass[m.tone]}`}
            onOpenChange={(open) => {
              if (!open) setMessages((list) => list.filter((x) => x.id !== m.id));
            }}
          >
            <RadixToast.Description>{m.text}</RadixToast.Description>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
