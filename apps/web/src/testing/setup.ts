import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// jsdom has no canvas: render Konva components as inert elements. Canvas behavior is
// covered by Playwright against a real browser.
vi.mock('react-konva', () => {
  const stub =
    (name: string) =>
    ({ children }: { children?: ReactNode }) =>
      createElement('div', { 'data-konva': name }, children);
  return Object.fromEntries(
    ['Stage', 'Layer', 'Group', 'Line', 'Rect', 'Circle', 'Image', 'Text', 'Path', 'Arrow'].map(
      (n) => [n, stub(n)],
    ),
  );
});

// jsdom lacks the pointer-capture and scroll APIs Radix Select uses.
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}

// jsdom has no ResizeObserver (react-resizable-panels measures its group with one) and never
// lays anything out, so the stub reports nothing.
if (typeof window !== 'undefined') {
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
