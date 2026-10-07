import { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AgeGate, { hasPassedAgeGate } from './components/AgeGate.jsx';
import Nav from './components/Nav.jsx';
import LoginPrompt from './components/LoginPrompt.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import FeedbackModal from './components/FeedbackModal.jsx';
import Feed from './pages/Feed.jsx';
import Discover from './pages/Discover.jsx';
import Upload from './pages/Upload.jsx';
import Profile from './pages/Profile.jsx';
import Me from './pages/Me.jsx';
import VideoPage from './pages/VideoPage.jsx';
import Legal from './pages/Legal.jsx';
import { useAuth } from './AuthContext.jsx';

export default function App() {
  const [ageOk, setAgeOk] = useState(hasPassedAgeGate);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { authPrompt, needsOnboarding, loading } = useAuth();
  const { pathname } = useLocation();

  // Legal pages stay readable before entering, since the gate links to them.
  if (!ageOk && !pathname.startsWith('/legal/')) return <AgeGate onPass={() => setAgeOk(true)} />;

  return (
    <div className="app">
      <Nav onFeedback={() => setFeedbackOpen(true)} />
      <main className="main">
        {loading ? (
          <div className="page center">
            <div className="spinner" />
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/me" element={<Me />} />
            <Route path="/u/:username" element={<Profile />} />
            <Route path="/v/:id" element={<VideoPage />} />
            <Route path="/legal/:doc" element={<Legal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
      {authPrompt && <LoginPrompt />}
      {needsOnboarding && <OnboardingModal />}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
