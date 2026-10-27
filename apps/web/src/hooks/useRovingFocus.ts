import { useCallback, useEffect, useRef, type FocusEvent, type KeyboardEvent } from 'react';

/**
 * Roving tabindex for a composite widget (toolbar, grid rows): one item is the tab stop
 * (`tabindex=0`), the others are `-1`, and the arrow keys, Home and End move focus between
 * them. Items are found by `selector` inside the container, so they can be any element.
 * The tab stop is the last focused item, else the one with `aria-selected="true"`, else the first.
 * `horizontal` uses Left/Right, `vertical` uses Up/Down.
 */
export function useRovingFocus<T extends HTMLElement>(
  selector: string,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
) {
  const ref = useRef<T>(null);
  const active = useRef<Element | null>(null);

  const items = useCallback(
    () => Array.from(ref.current?.querySelectorAll<HTMLElement>(selector) ?? []),
    [selector],
  );

  // After every render: the set of items may have changed (rows added, buttons disabled).
  useEffect(() => {
    const all = items();
    const stop =
      all.find((el) => el === active.current) ??
      all.find((el) => el.getAttribute('aria-selected') === 'true') ??
      all[0];
    for (const el of all) el.tabIndex = el === stop ? 0 : -1;
  });

  const onFocus = useCallback(
    (e: FocusEvent<T>) => {
      const all = items();
      const target = all.find((el) => el === e.target);
      if (!target) return;
      active.current = target;
      for (const el of all) el.tabIndex = el === target ? 0 : -1;
    },
    [items],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<T>) => {
      const all = items();
      const index = all.findIndex((el) => el === e.target);
      if (index < 0) return;
      const [prev, next] =
        orientation === 'horizontal' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
      let to = -1;
      if (e.key === next) to = Math.min(index + 1, all.length - 1);
      else if (e.key === prev) to = Math.max(index - 1, 0);
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = all.length - 1;
      if (to < 0) return;
      e.preventDefault();
      all[to]!.focus();
    },
    [items, orientation],
  );

  return { ref, onFocus, onKeyDown };
}
