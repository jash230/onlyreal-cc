import { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
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

  if (!ageOk) {
    // Legal pages stay readable before entering (the gate links to them), but standalone: no nav,
    // modals or other routes, so they can't be used as a side door into the app.
    if (!pathname.startsWith('/legal/')) return <AgeGate onPass={() => setAgeOk(true)} />;
    return (
      <main className="main legal-standalone">
        <Link to="/" className="btn btn-glass legal-back">
          ← Back
        </Link>
        <Routes>
          <Route path="/legal/:doc" element={<Legal />} />
        </Routes>
      </main>
    );
  }

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
            <Route path="/search" element={<Discover />} />
            <Route path="/discover" element={<Navigate to="/search" replace />} />
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
