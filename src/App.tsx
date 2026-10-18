import { X } from 'lucide-react';
import { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import VictoryPage from './pages/VictoryPage';
import RoomsPage from './pages/RoomsPage';
import AuthPage from './pages/AuthPage';
import { useVersionCheck } from './hooks/useVersionCheck';
import AuthGate from './components/AuthGate';

/**
 * "New version" notice: a small dismissible card under the header (on phones, below the
 * Vote link / Dict buttons). It used to be a full-width bar pinned to the bottom, which
 * covered the add-word dock.
 */
function UpdateBanner() {
  const updateAvailable = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);
  if (!updateAvailable || dismissed) return null;
  return (
    <div className="fixed top-[9.5rem] md:top-[4.5rem] inset-x-4 z-50 flex justify-center pointer-events-none">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-3 max-w-md bg-brand-600 rounded-xl px-4 py-2 text-sm text-white shadow-lg"
      >
        <span>มีเวอร์ชันใหม่ — รีเฟรชหลังเล่นจบเพื่ออัปเดต</span>
        <button
          onClick={() => window.location.reload()}
          className="flex-shrink-0 rounded bg-white px-3 py-1 font-semibold text-brand-600 transition-colors hover:bg-brand-50"
        >
          รีเฟรช
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="flex-shrink-0 text-white/80 hover:text-white"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <AuthGate>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/login" element={<AuthPage key="login" mode="login" />} />
          <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
          <Route path="/join/:roomId" element={<HomePage />} />
          <Route path="/lobby/:roomId" element={<LobbyPage />} />
          <Route path="/game/:roomId" element={<GamePage />} />
          <Route path="/victory/:roomId" element={<VictoryPage />} />
        </Routes>
      </HashRouter>
      </AuthGate>
      <UpdateBanner />
    </>
  );
}
