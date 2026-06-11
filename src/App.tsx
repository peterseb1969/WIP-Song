import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BootstrapGate } from './components/BootstrapGate'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import PlaceholderPage from './pages/PlaceholderPage'

// Path-prefix-ready for k8s/ingress (CASE-370): without this basename, React
// Router's <Link>/navigate() drop the deploy prefix and reloads 404 at the
// ingress. Net-zero for local dev — BASE_URL is '/' → basename '/'.
const BASENAME = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/'

export default function App() {
  return (
    <BootstrapGate>
      <BrowserRouter basename={BASENAME}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/songs"
              element={<PlaceholderPage title="Songs" comingIn="Song library and import arrive in build phase 3." />}
            />
            <Route
              path="/lessons"
              element={<PlaceholderPage title="Lessons" comingIn="Lessons arrive in build phase 7." />}
            />
            <Route
              path="/progress"
              element={<PlaceholderPage title="Progress" comingIn="Progress history arrives in build phase 8." />}
            />
            <Route
              path="/profile"
              element={<PlaceholderPage title="Profile" comingIn="Singer profile arrives in build phase 2." />}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </BootstrapGate>
  )
}
