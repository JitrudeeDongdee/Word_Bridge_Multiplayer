import {
  EmailAuthProvider,
  FacebookAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  deleteUser,
  signOut as fbSignOut,
  updateProfile,
  type AuthProvider,
  type User,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { get, ref, remove, set, update } from 'firebase/database';
import { auth, db } from './firebase';

/**
 * Accounts. Everyone has a Firebase Auth user: guests are signed in anonymously, and
 * signing up *upgrades* that same user (link), so the uid — the player id — and any room
 * the guest is in carry over. Logging in to an existing account switches to its uid.
 */

export interface UserProfile {
  name: string;
  createdAt: number;
}

export const NAME_MAX = 20;

/** Resolves once Firebase has restored (or failed to find) the saved session. */
function authReady(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
  });
}

/**
 * Makes sure there is a signed-in user, signing in anonymously as a guest if needed.
 * Returns null when anonymous sign-in isn't available (provider disabled / offline):
 * the app then keeps working without auth, which only open database rules allow.
 */
export async function ensureSignedIn(): Promise<User | null> {
  const existing = auth.currentUser ?? (await authReady());
  if (existing) return existing;
  try {
    return (await signInAnonymously(auth)).user;
  } catch (e) {
    console.warn('Guest sign-in failed', e);
    return null;
  }
}

/** The player id for new rooms / joins: the signed-in uid. */
export function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

export function isMember(user: User | null): boolean {
  return !!user && !user.isAnonymous;
}

export async function loadProfile(uid: string): Promise<UserProfile | null> {
  const snap = await get(ref(db, `users/${uid}`));
  return snap.exists() ? (snap.val() as UserProfile) : null;
}

async function saveProfile(user: User, name: string): Promise<void> {
  const clean = name.trim().slice(0, NAME_MAX);
  const existing = await loadProfile(user.uid);
  if (existing) await update(ref(db, `users/${user.uid}`), { name: clean });
  else await set(ref(db, `users/${user.uid}`), { name: clean, createdAt: Date.now() });
}

export async function setDisplayName(name: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  await Promise.all([updateProfile(user, { displayName: name.trim().slice(0, NAME_MAX) }), saveProfile(user, name)]);
}

/** Name to play under after signing in: saved profile → provider name → fallback. */
async function profileNameFor(user: User, fallback: string): Promise<string> {
  const profile = await loadProfile(user.uid).catch(() => null);
  if (profile?.name) return profile.name;
  const name = (user.displayName || fallback).trim().slice(0, NAME_MAX) || 'Player';
  await saveProfile(user, name).catch(() => {});
  return name;
}

export interface SignedIn {
  user: User;
  name: string;
  /** false when an existing account was used (uid changed: the guest's rooms stay with the guest) */
  keptGuestId: boolean;
}

async function withProvider(provider: AuthProvider, fallbackName: string): Promise<SignedIn> {
  const current = auth.currentUser;
  if (current?.isAnonymous) {
    try {
      const { user } = await linkWithPopup(current, provider);
      return { user, name: await profileNameFor(user, fallbackName), keptGuestId: true };
    } catch (e) {
      // This Google/Facebook account already has a Word Bridge account: log in to it
      if (e instanceof FirebaseError && e.code === 'auth/credential-already-in-use') {
        const cred = provider instanceof GoogleAuthProvider
          ? GoogleAuthProvider.credentialFromError(e)
          : FacebookAuthProvider.credentialFromError(e);
        if (cred) {
          const { user } = await signInWithCredential(auth, cred);
          return { user, name: await profileNameFor(user, fallbackName), keptGuestId: false };
        }
      }
      throw e;
    }
  }
  const { user } = await signInWithPopup(auth, provider);
  return { user, name: await profileNameFor(user, fallbackName), keptGuestId: false };
}

export const signInWithGoogle = (fallbackName: string) => withProvider(new GoogleAuthProvider(), fallbackName);
export const signInWithFacebook = (fallbackName: string) => withProvider(new FacebookAuthProvider(), fallbackName);

export async function signUpWithEmail(email: string, password: string, name: string): Promise<SignedIn> {
  const current = auth.currentUser;
  const user = current?.isAnonymous
    ? (await linkWithCredential(current, EmailAuthProvider.credential(email, password))).user
    : (await createUserWithEmailAndPassword(auth, email, password)).user;
  const clean = name.trim().slice(0, NAME_MAX) || 'Player';
  await updateProfile(user, { displayName: clean }).catch(() => {});
  await saveProfile(user, clean);
  return { user, name: clean, keptGuestId: !!current?.isAnonymous };
}

export async function logInWithEmail(email: string, password: string, fallbackName: string): Promise<SignedIn> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return { user, name: await profileNameFor(user, fallbackName), keptGuestId: false };
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

/** Log out, then continue as a fresh guest. */
export async function logOut(): Promise<User | null> {
  await fbSignOut(auth);
  return ensureSignedIn();
}

/**
 * Deletes everything stored about the signed-in player (guest or member): their profile,
 * their link votes, their seat in any room, and the sign-in account itself. Rooms, chat and
 * words already expire on their own. Afterwards the browser continues as a fresh guest.
 */
export async function deleteMyData(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  const uid = user.uid;
  const [votes, rooms] = await Promise.all([get(ref(db, 'pairVotes')), get(ref(db, 'rooms'))]);
  const removals: Promise<void>[] = [remove(ref(db, `users/${uid}`))];
  for (const [pair, record] of Object.entries((votes.val() ?? {}) as Record<string, { voters?: Record<string, { playerId?: string }> }>)) {
    for (const [voter, v] of Object.entries(record.voters ?? {})) {
      if (v?.playerId === uid) removals.push(remove(ref(db, `pairVotes/${pair}/voters/${voter}`)));
    }
  }
  for (const [roomId, room] of Object.entries((rooms.val() ?? {}) as Record<string, { players?: Record<string, unknown> }>)) {
    if (room.players?.[uid]) removals.push(remove(ref(db, `rooms/${roomId}/players/${uid}`)));
  }
  await Promise.all(removals);
  // Last: needs a recent sign-in for members (auth/requires-recent-login)
  await deleteUser(user);
  await ensureSignedIn();
}

/** Friendly text for Firebase Auth errors. */
export function authErrorMessage(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'The sign-in window was blocked. Allow pop-ups, or open the game in your browser (not inside an app).';
    case 'auth/operation-not-supported-in-this-environment':
    case 'auth/web-storage-unsupported':
      return "This browser can't sign in. Open the game in Chrome or Safari.";
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use':
      return 'That email already has an account. Log in instead.';
    case 'auth/account-exists-with-different-credential':
      return 'This email is already used with another sign-in method. Log in with that one.';
    case 'auth/invalid-email':
      return 'That email address looks wrong.';
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a moment and try again.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return "This sign-in method isn't turned on yet.";
    case 'auth/unauthorized-domain':
      return "Sign-in isn't set up for this website address yet.";
    case 'auth/requires-recent-login':
      return 'For your security, log out and log in again, then delete your data.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
