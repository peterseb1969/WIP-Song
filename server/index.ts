import 'dotenv/config'  // Must be first — loads .env before any other module reads process.env
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import { wipProxy } from '@wip/proxy'
import { initAgent, ask } from './agent.js'
import { initAuth, requireAuth, handleCallback, handleLogout } from './auth.js'
import bootstrapRouter from './routes/bootstrap.js'
import importRouter from './routes/import.js'
import { WIP_BASE_URL } from './lib/wip-api.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = parseInt(process.env.PORT || '3016')
// Path-prefix-ready for k8s/ingress (CASE-370). Net-zero for local dev:
// APP_BASE_PATH unset → BASE_PATH '' → the router mounts at '/' and the session
// cookie path is '/', identical to before.
const BASE_PATH = (process.env.APP_BASE_PATH || '').replace(/\/+$/, '')
const COOKIE_PATH = BASE_PATH ? BASE_PATH + '/' : '/'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const router = express.Router()

app.use(cors())

// --- Session (required for OIDC auth). Cookie scoped to the app's base path
// so sibling apps behind the same ingress don't share it. ---
router.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    path: COOKIE_PATH,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}))

// --- Auth routes ---
router.get('/auth/callback', (req, res) => { handleCallback(req, res) })
router.get('/auth/logout', handleLogout)

// --- Auth middleware (no-op when OIDC_ISSUER is not set) ---
router.use(requireAuth())

// --- WIP API proxy. MUST be mounted before express.json(): @wip/proxy
// forwards raw request bodies, and a JSON parser ahead of it would consume
// the stream and forward empty bodies (see docs/technology-stack.md §4). ---
// Namespace scoping: wip-deploy dev renders inject the install ADMIN key
// (multi-namespace), which gets no automatic namespace derivation — reads
// with value-form template IDs silently return nothing. Pin every proxied
// WIP call to our namespace via query param unless the caller already
// scoped it; under the single-namespace runtime key this matches what
// derivation would do anyway. (@wip/proxy forwards req.url verbatim.)
const WIP_NAMESPACE = process.env.WIP_NAMESPACE || 'dev-wip-song'
router.use((req, _res, next) => {
  if (
    req.url.startsWith('/wip/api/') &&
    // The files API takes namespace as a multipart FORM field and strictly
    // rejects unknown query params (422 unknown_query_param) — never inject
    // there; @wip/client's uploadFile already scopes via the form field.
    !req.url.startsWith('/wip/api/document-store/files') &&
    !/[?&]namespace=/.test(req.url)
  ) {
    req.url += `${req.url.includes('?') ? '&' : '?'}namespace=${encodeURIComponent(WIP_NAMESPACE)}`
  }
  next()
})
router.use('/wip', wipProxy({
  baseUrl: WIP_BASE_URL,
  apiKey: process.env.WIP_API_KEY || '',
}))

// JSON parsing for the app's own routes — AFTER the proxy.
router.use(express.json())

// --- Bootstrap status/run (offer-on-empty / use-on-exists, see CLAUDE.md) ---
router.use('/server-api', bootstrapRouter)

// --- Song import parsing (.mid/.kar → canonical note events) ---
router.use('/server-api', importRouter)

// --- Health ---
router.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// --- Ask endpoint ---
router.post('/api/ask', async (req, res) => {
  const { question, sessionId } = req.body
  if (!question) {
    res.status(400).json({ error: 'question is required' })
    return
  }
  try {
    const result = await ask(question, sessionId)
    res.json(result)
  } catch (err: any) {
    console.error('Ask error:', err)
    res.status(500).json({ error: err.message || 'Internal error' })
  }
})

// --- User info. Three identity sources in priority order (deployable-app
// contract, "Skip 7"): gateway-injected headers (wip-router hybrid auth) →
// OIDC session → local-dev fallback so standalone dev still has a stable
// singer identity. ---
router.get('/api/me', (req, res) => {
  const gatewayUser = req.header('X-WIP-User')
  if (gatewayUser) {
    res.json({
      sub: gatewayUser,
      name: gatewayUser,
      groups: (req.header('X-WIP-Groups') || '').split(',').filter(Boolean),
      source: 'gateway',
    })
    return
  }
  if (req.session.user) {
    res.json({ ...req.session.user, source: 'oidc' })
    return
  }
  res.json({ sub: 'local-dev', name: 'Local Singer', anonymous: true, source: 'fallback' })
})

// --- Production: serve the built SPA from this router so the app is
// self-contained behind the ingress (CASE-370). Dev serves the SPA via Vite. ---
if (process.env.NODE_ENV === 'production') {
  const distDir = path.resolve(__dirname, '..', 'dist')
  router.use(express.static(distDir))
  // SPA fallback for client-side routes. A middleware (not app.get('*')) —
  // Express 5 / path-to-regexp rejects a bare '*' route pattern.
  router.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

// Mount everything under the base path (CASE-370); '/' for local dev.
app.use(BASE_PATH || '/', router)

// --- Start ---
async function main() {
  await initAuth()
  await initAgent()
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}${BASE_PATH || ''}`)
  })
}

main().catch(err => {
  console.error('Failed to start:', err)
  process.exit(1)
})
