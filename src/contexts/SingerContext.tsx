/**
 * Singer identity context. Resolves who is singing (gateway header → OIDC
 * session → local-dev fallback, via /api/me) and loads-or-creates the
 * SONG_SINGER profile document keyed by the OIDC subject.
 *
 * Auto-create is safe against double-fires (React StrictMode, refetches):
 * SONG_SINGER's identity_fields=[subject], so a duplicate create is an
 * upsert onto the same document (PoNIF #3), not a second profile.
 */

import { createContext, useContext, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useQueryDocuments, useCreateDocument } from '@wip/react'
import type { Document } from '@wip/client'
import { apiUrl, WIP_NAMESPACE } from '../lib/config'

export interface Me {
  sub: string
  name?: string
  email?: string
  anonymous?: boolean
  source: 'gateway' | 'oidc' | 'fallback'
}

export interface SingerData {
  subject: string
  display_name: string
  email?: string
  voice_type?: string
  range_low_midi?: number
  range_high_midi?: number
  preferences?: {
    note_view?: 'piano' | 'fretboard' | 'both'
    /** Octaves of displacement that still score full credit (see scoring.ts). */
    octave_tolerance?: number
  } & Record<string, unknown>
}

interface SingerContextValue {
  me: Me | undefined
  singer: Document | undefined
  singerData: SingerData | undefined
  singerId: string | undefined
  isLoading: boolean
}

const SingerContext = createContext<SingerContextValue | null>(null)

export function SingerProvider({ children }: { children: React.ReactNode }) {
  const { data: me } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch(apiUrl('/me'))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60_000,
  })

  const singerQuery = useQueryDocuments({
    template_id: 'SONG_SINGER',
    filters: me?.sub ? [{ field: 'data.subject', operator: 'eq', value: me.sub }] : [],
    page_size: 1,
  })

  const createSinger = useCreateDocument()
  const creatingFor = useRef<string | null>(null)

  useEffect(() => {
    if (!me?.sub || singerQuery.isLoading || singerQuery.isError) return
    const exists = (singerQuery.data?.items?.length ?? 0) > 0
    if (exists || creatingFor.current === me.sub) return
    creatingFor.current = me.sub
    createSinger.mutate({
      template_id: 'SONG_SINGER',
      namespace: WIP_NAMESPACE,
      data: {
        subject: me.sub,
        display_name: me.name || me.sub,
        ...(me.email ? { email: me.email } : {}),
      },
      created_by: 'wip-song-app',
    })
  }, [me, singerQuery.data, singerQuery.isLoading, singerQuery.isError, createSinger])

  const singer = singerQuery.data?.items?.[0]

  return (
    <SingerContext.Provider
      value={{
        me,
        singer,
        singerData: singer?.data as SingerData | undefined,
        singerId: singer?.document_id,
        isLoading: !me || singerQuery.isLoading,
      }}
    >
      {children}
    </SingerContext.Provider>
  )
}

export function useSinger(): SingerContextValue {
  const ctx = useContext(SingerContext)
  if (!ctx) throw new Error('useSinger must be used inside <SingerProvider>')
  return ctx
}
