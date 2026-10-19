import { create } from 'zustand';
import type { User } from 'firebase/auth';

interface AuthStore {
  /** Firebase user: anonymous for guests. null until signed in (or if guest sign-in is unavailable). */
  user: User | null;
  /** Saved display name of a member (users/{uid}/name) */
  memberName: string | null;
  /** Member's avatar (data URL), if they set one */
  memberPhoto: string | null;
  /** The first sign-in attempt has finished */
  ready: boolean;
  set: (patch: Partial<Omit<AuthStore, 'set'>>) => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  memberName: null,
  memberPhoto: null,
  ready: false,
  set: (patch) => set(patch),
}));
