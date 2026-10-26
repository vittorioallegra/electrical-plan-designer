// Which tab holds the draft. There is one draft per browser, so only one tab may write it:
// the holder answers other tabs over a BroadcastChannel, and a tab that takes the project
// over makes the holder read-only. A closed or crashed holder simply stops answering.
import type { DraftHolder, DraftPresence } from './types';

type Message =
  | { type: 'query'; id: string }
  | { type: 'held'; id: string; holder: DraftHolder }
  | { type: 'claim'; id: string }
  | { type: 'released'; id: string };

export const DRAFT_CHANNEL = 'epd-draft';

export function createDraftPresence({
  channelName = DRAFT_CHANNEL,
  answerMs = 150,
  releaseMs = 2000,
}: {
  channelName?: string;
  /** How long to wait for the holder to answer (a live tab answers within milliseconds). */
  answerMs?: number;
  /** How long a claim waits for the holder to write its last changes and let go. */
  releaseMs?: number;
} = {}): DraftPresence {
  if (typeof BroadcastChannel === 'undefined') {
    return {
      holder: async () => null,
      claim: async () => undefined,
      hold: () => undefined,
      onTakenOver: () => () => undefined,
    };
  }
  const channel = new BroadcastChannel(channelName);
  let current: (() => DraftHolder) | null = null;
  const takenOver = new Set<() => void | Promise<void>>();
  const waiting = new Map<string, (message: Message) => void>();
  const newRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const post = (message: Message) => channel.postMessage(message);

  channel.onmessage = (event: MessageEvent<Message>) => {
    const message = event.data;
    if (message.type === 'query' && current) {
      post({ type: 'held', id: message.id, holder: current() });
    } else if (message.type === 'claim' && current) {
      current = null;
      void Promise.allSettled([...takenOver].map((listener) => listener())).then(() =>
        post({ type: 'released', id: message.id }),
      );
    } else if (message.type === 'held' || message.type === 'released') {
      waiting.get(message.id)?.(message);
    }
  };

  /** Posts a request and resolves with the first answer, or null after `waitMs`. */
  function ask(message: Message, waitMs: number): Promise<Message | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        waiting.delete(message.id);
        resolve(null);
      }, waitMs);
      waiting.set(message.id, (answer) => {
        clearTimeout(timer);
        waiting.delete(message.id);
        resolve(answer);
      });
      post(message);
    });
  }

  return {
    async holder() {
      const answer = await ask({ type: 'query', id: newRequestId() }, answerMs);
      return answer?.type === 'held' ? answer.holder : null;
    },
    async claim() {
      await ask({ type: 'claim', id: newRequestId() }, releaseMs);
    },
    hold(info) {
      current = info;
    },
    onTakenOver(listener) {
      takenOver.add(listener);
      return () => takenOver.delete(listener);
    },
  };
}
