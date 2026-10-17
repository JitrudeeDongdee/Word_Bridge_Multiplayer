import { useEffect, useState } from 'react';

/**
 * Height (px) of the area at the bottom of the layout viewport that is hidden
 * by the on-screen keyboard (iOS/Android), so bottom-docked UI can sit above it.
 * Always 0 on desktop.
 */
function measure(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(measure);

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

  return inset;
}
