import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BootstrapGate } from './components/BootstrapGate'
import { SingerProvider } from './contexts/SingerContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'
import SongsPage from './pages/SongsPage'
import SongDetailPage from './pages/SongDetailPage'
import PracticeIndexPage from './pages/PracticeIndexPage'
import PracticePage from './pages/PracticePage'
import PlaceholderPage from './pages/PlaceholderPage'

// Path-prefix-ready for k8s/ingress (CASE-370): without this basename, React
// Router's <Link>/navigate() drop the deploy prefix and reloads 404 at the
// ingress. Net-zero for local dev — BASE_URL is '/' → basename '/'.
const BASENAME = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/'

export default function App() {
  return (
    <BootstrapGate>
      <SingerProvider>
        <BrowserRouter basename={BASENAME}>
          <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/songs" element={<SongsPage />} />
            <Route path="/songs/:id" element={<SongDetailPage />} />
            <Route path="/practice" element={<PracticeIndexPage />} />
            <Route path="/practice/:id" element={<PracticePage />} />
            <Route
              path="/lessons"
              element={<PlaceholderPage title="Lessons" comingIn="Lessons arrive in build phase 7." />}
            />
            <Route
              path="/progress"
              element={<PlaceholderPage title="Progress" comingIn="Progress history arrives in build phase 8." />}
            />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Routes>
        </BrowserRouter>
      </SingerProvider>
    </BootstrapGate>
  )
}
