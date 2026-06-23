# Custom Words Feature — Setup Guide

## What Was Added

Players can now submit custom words via the "+ Add Word" button. The system:
1. **Validates** against the free English dictionary API
2. **Stores** valid words in a global pool (`/globalCustomWords`)
3. **Shares** across all players in real-time
4. **Suggests** custom words in autocomplete alongside API suggestions

## Current Status

✅ Code is built and running  
❌ Firebase rules need to be applied (currently getting permission_denied errors)

## Next Step: Apply Firebase Rules

### Option 1️⃣ Production (Real Firebase Project)

1. Open [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Realtime Database** → **Rules** tab
4. Replace the entire rules with this:

```json
{
  "rules": {
    "rooms": { ".read": true, ".write": true },
    "presence": { ".read": true, ".write": true },
    "stats": { ".read": true, ".write": true },
    "globalCustomWords": { ".read": true, ".write": true }
  }
}
```

5. Click **Publish**

### Option 2️⃣ Local Testing (Firebase Emulator)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize emulator in your project
cd "/Users/digimusketeers/Desktop/worl brige/Word_Bridge_Multiplayer"
firebase init emulators

# When prompted, select "Realtime Database" emulator
# Start the emulator
firebase emulators:start --only database

# Update .env to use local emulator
# Change VITE_FIREBASE_DATABASE_URL to:
# http://localhost:9000?ns=your-project-id
```

## After Rules Are Applied

The feature will work immediately:
- Users submit a word → system checks dictionary → saves to DB
- All connected players see the new word in suggestions (within 1-2 seconds)
- Custom words persist across sessions

## Files Added/Modified

- ✨ Created: `src/services/customWordsService.ts`
- ✨ Created: `src/hooks/useCustomWordsSubscription.ts`
- 📝 Modified: `src/components/AddWordPanel.tsx` (validation + DB save)
- 📝 Modified: `src/components/GameCanvas.tsx` (dictionary suggestions)
- 📋 Reference: `firebase.rules.json` (apply to Firebase)

---

**Questions?**
- Rules too open? Add `.auth !== null` to require authentication
- Want moderation? Add a manual approval step before `.write` proceeds
- Need local wordlist? Store words in `src/data/wordlist.json` as fallback
