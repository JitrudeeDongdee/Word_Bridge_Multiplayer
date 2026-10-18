import { useEffect, useRef, useState } from 'react';

export interface KeyboardState {
  /**
   * Height (px) of the area at the bottom of the layout viewport that is hidden
   * by the on-screen keyboard (iOS/Android), so bottom-docked UI can sit above it.
   * Always 0 on desktop.
   */
  inset: number;
  /**
   * The keyboard is probably open but drawn over the page without telling it:
   * a text field is focused on a touch screen, yet neither the layout nor the
   * visual viewport shrank. Seen in in-app browsers (e.g. Messenger on Android).
   * Bottom-docked UI can't be placed above a keyboard it can't measure, so it
   * should move to the top of the screen instead: this is the y (px) just under
   * the page header to place it at, or null when the bottom is usable.
   */
  coveredTop: number | null;
}

function measure(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image']);
function isTextField(el: Element | null): boolean {
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type);
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
}

const viewportSize = () => ({ h: window.innerHeight, vv: window.visualViewport?.height ?? window.innerHeight });
const KEYBOARD_OPEN_MS = 500; // time for the keyboard to slide in
const SHRINK_PX = 80; // less than this isn't a keyboard (e.g. a URL bar collapsing)

export function useKeyboardInset(): KeyboardState {
  const [inset, setInset] = useState(measure);
  const [coveredTop, setCoveredTop] = useState<number | null>(null);
  // Viewport size with no keyboard open, to tell whether focusing a field shrank it
  const baseRef = useRef(viewportSize());

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(measure());
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (!isTextField(document.activeElement)) baseRef.current = viewportSize();
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!isTextField(e.target as Element)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const base = baseRef.current, now = viewportSize();
        const covered = now.h > base.h - SHRINK_PX && now.vv > base.vv - SHRINK_PX;
        const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
        setCoveredTop(covered ? Math.round(Math.max(0, header)) + 8 : null);
      }, KEYBOARD_OPEN_MS);
    };
    const onFocusOut = () => {
      clearTimeout(timer);
      // Focus may be moving to another field; check once it has landed
      setTimeout(() => {
        if (!isTextField(document.activeElement)) {
          setCoveredTop(null);
          baseRef.current = viewportSize();
        }
      }, 0);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return { inset, coveredTop };
}
