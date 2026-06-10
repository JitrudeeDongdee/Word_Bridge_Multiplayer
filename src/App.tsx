import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import VictoryPage from './pages/VictoryPage';
import { useVersionCheck } from './hooks/useVersionCheck';

function UpdateBanner() {
  const updateAvailable = useVersionCheck();
  if (!updateAvailable) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">
      <span>มีเวอร์ชันใหม่ — รีเฟรชหลังเล่นจบเพื่ออัปเดต</span>
      <button
        onClick={() => window.location.reload()}
        className="ml-4 rounded bg-white px-3 py-1 font-semibold text-brand-600 transition-colors hover:bg-brand-50"
      >
        รีเฟรช
      </button>
    </div>
  );
}

export default function App() {
  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/join/:roomId" element={<HomePage />} />
          <Route path="/lobby/:roomId" element={<LobbyPage />} />
          <Route path="/game/:roomId" element={<GamePage />} />
          <Route path="/victory/:roomId" element={<VictoryPage />} />
        </Routes>
      </HashRouter>
      <UpdateBanner />
    </>
  );
}
