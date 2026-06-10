import { useEffect, useState } from 'react';

const VERSION_URL = import.meta.env.BASE_URL + 'version.txt';
const CHECK_INTERVAL_MS = 60_000;

export function useVersionCheck(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let initialVersion: string | null = null;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const version = (await res.text()).trim();
        if (initialVersion === null) {
          initialVersion = version;
        } else if (version !== initialVersion && !cancelled) {
          setUpdateAvailable(true);
        }
      } catch {
        // network error — ignore
      }
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return updateAvailable;
}
