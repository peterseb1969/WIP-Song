import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createWipClient } from '@wip/client'
import { WipProvider } from '@wip/react'
import App from './App'
import { WIP_PROXY_BASE } from './lib/config'
import './index.css'

const queryClient = new QueryClient()

// All WIP API traffic goes through the Express @wip/proxy mount — the
// browser never sees the API key, so no auth config here.
const wipClient = createWipClient({
  baseUrl: WIP_PROXY_BASE,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WipProvider client={wipClient}>
        <App />
      </WipProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
