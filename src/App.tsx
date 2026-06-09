import { HashRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import VictoryPage from './pages/VictoryPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/join/:roomId" element={<HomePage />} />
        <Route path="/lobby/:roomId" element={<LobbyPage />} />
        <Route path="/game/:roomId" element={<GamePage />} />
        <Route path="/victory/:roomId" element={<VictoryPage />} />
      </Routes>
    </HashRouter>
  );
}
