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
import LessonsPage from './pages/LessonsPage'
import LessonDetailPage from './pages/LessonDetailPage'
import ProgressPage from './pages/ProgressPage'
import AuthorHubPage from './pages/AuthorHubPage'
import LessonBuilderPage from './pages/LessonBuilderPage'
import ExerciseFormPage from './pages/ExerciseFormPage'
import SettingsPage from './pages/SettingsPage'
import { useAuthoringEnabled } from './lib/authoring'

// Path-prefix-ready for k8s/ingress (CASE-370): without this basename, React
// Router's <Link>/navigate() drop the deploy prefix and reloads 404 at the
// ingress. Net-zero for local dev — BASE_URL is '/' → basename '/'.
const BASENAME = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/'

export default function App() {
  const authoringEnabled = useAuthoringEnabled()
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
            <Route path="/lessons" element={<LessonsPage />} />
            <Route path="/lessons/:id" element={<LessonDetailPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {authoringEnabled && (
              <>
                <Route path="/author" element={<AuthorHubPage />} />
                <Route path="/author/lessons/new" element={<LessonBuilderPage />} />
                <Route path="/author/lessons/:id" element={<LessonBuilderPage />} />
                <Route path="/author/exercises/new" element={<ExerciseFormPage />} />
              </>
            )}
          </Route>
        </Routes>
        </BrowserRouter>
      </SingerProvider>
    </BootstrapGate>
  )
}
