import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useMemo } from 'react'
import type {
  EntryPatch,
  PlaythroughInput,
  PlaythroughPatch,
  ProfilePatch,
} from '@shared/schemas.ts'
import type {
  ActivityItem,
  ChartList,
  ChartPage,
  EpisodeList,
  EpisodeMark,
  Kind,
  LibraryEntry,
  LibraryStats,
  SearchResult,
  SessionInfo,
  Status,
  StoreOffer,
  TitleRecord,
  User,
  UserProfile,
} from '@shared/types.ts'
import { useI18n } from '@/i18n'
import { api, get, query } from './api'

export const keys = {
  session: ['session'] as const,
  library: ['library'] as const,
  stats: ['stats'] as const,
  activity: ['activity'] as const,
  sessions: ['sessions'] as const,
  profile: (id: string) => ['profile', id] as const,
  charts: (kind: Kind, list: ChartList, locale: string, region: string) =>
    ['charts', kind, list, locale, region] as const,
  search: (q: string, kind: string, locale: string) => ['search', q, kind, locale] as const,
  title: (id: string, locale: string) => ['title', id, locale] as const,
  episodes: (id: string) => ['episodes', id] as const,
  marks: (id: string) => ['marks', id] as const,
  offers: (id: string, region: string) => ['offers', id, region] as const,
}

// ---------------------------------------------------------------------------
// Session

interface SessionResponse {
  user: User | null
  registrationOpen: boolean
}

export function useSession() {
  const result = useQuery({
    queryKey: keys.session,
    queryFn: ({ signal }) => get<SessionResponse>('/auth/session', signal),
    staleTime: 5 * 60_000,
    retry: 1,
  })
  return {
    user: result.data?.user ?? null,
    registrationOpen: result.data?.registrationOpen ?? true,
    isLoading: result.isLoading,
    isError: result.isError,
  }
}

export function useUser() {
  return useSession().user
}

export function resetUserData(client: QueryClient) {
  for (const key of [keys.library, keys.stats, keys.activity, keys.sessions, ['marks']])
    client.removeQueries({ queryKey: key })
  try {
    localStorage.removeItem('mediashelf:shuffle-history')
  } catch {
    /* ignore */
  }
}

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<{ user: User }>('POST', '/auth/login', input),
    onSuccess: ({ user }) => {
      resetUserData(client)
      client.setQueryData<SessionResponse>(keys.session, (old) => ({
        registrationOpen: old?.registrationOpen ?? true,
        user,
      }))
    },
  })
}

export interface RegisterStartResult {
  sent: boolean
  delivered: boolean
  devCode?: string
}

export function useRegisterStart() {
  return useMutation({
    mutationFn: (input: {
      name: string
      email: string
      password: string
      locale: string
      theme: string
    }) => api<RegisterStartResult>('POST', '/auth/register/start', input),
  })
}

export function useRegisterResend() {
  return useMutation({
    mutationFn: (input: { email: string }) =>
      api<RegisterStartResult>('POST', '/auth/register/resend', input),
  })
}

/**
 * The caller applies the session itself via the returned `signIn`, once its success animation
 * is done. Setting it here would let the guest-only route guard redirect to "/" first and the
 * page's own delayed navigate('/welcome') would then yank the user away from wherever they went.
 */
export function useRegisterVerify() {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: { email: string; code: string; locale: string; theme: string }) =>
      api<{ user: User }>('POST', '/auth/register/verify', input),
  })
  const signIn = (user: User) => {
    resetUserData(client)
    client.setQueryData<SessionResponse>(keys.session, { registrationOpen: true, user })
  }
  return Object.assign(mutation, { signIn })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api<{ ok: true }>('POST', '/auth/logout'),
    onSettled: () => {
      resetUserData(client)
      client.setQueryData<SessionResponse>(keys.session, (old) => ({
        registrationOpen: old?.registrationOpen ?? true,
        user: null,
      }))
    },
  })
}

export function useUpdateProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfilePatch) => api<{ user: User }>('PATCH', '/me', patch),
    onSuccess: ({ user }) =>
      client.setQueryData<SessionResponse>(keys.session, (old) => ({
        registrationOpen: old?.registrationOpen ?? true,
        user,
      })),
  })
}

export function useSessions(enabled = true) {
  return useQuery({
    queryKey: keys.sessions,
    queryFn: ({ signal }) => get<{ sessions: SessionInfo[] }>('/me/sessions', signal),
    enabled,
  })
}

// ---------------------------------------------------------------------------
// Library

export function useLibrary() {
  const user = useUser()
  return useQuery({
    queryKey: keys.library,
    queryFn: ({ signal }) =>
      get<{ entries: LibraryEntry[] }>('/library', signal).then((data) => data.entries),
    enabled: Boolean(user),
    staleTime: 60_000,
  })
}

export function useLibraryMap() {
  const { data } = useLibrary()
  return useMemo(() => new Map((data ?? []).map((entry) => [entry.titleId, entry])), [data])
}

export function useEntry(titleId: string | undefined) {
  const map = useLibraryMap()
  return titleId ? (map.get(titleId) ?? null) : null
}

export function setEntry(client: QueryClient, entry: LibraryEntry) {
  client.setQueryData<LibraryEntry[]>(keys.library, (old) => {
    if (!old) return old
    const index = old.findIndex((item) => item.titleId === entry.titleId)
    if (index < 0) return [entry, ...old]
    const next = old.slice()
    next[index] = entry
    return next
  })
}

function patchEntry(client: QueryClient, titleId: string, patch: Partial<LibraryEntry>) {
  client.setQueryData<LibraryEntry[]>(keys.library, (old) =>
    old?.map((item) =>
      item.titleId === titleId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
    ),
  )
}

/** Rolls back one entry: its previous version, or nothing if it was provisional. */
function restoreEntry(client: QueryClient, titleId: string, previous: LibraryEntry | undefined) {
  if (previous) setEntry(client, previous)
  else
    client.setQueryData<LibraryEntry[]>(keys.library, (old) =>
      old?.filter((entry) => entry.titleId !== titleId),
    )
}

function invalidateDerived(client: QueryClient) {
  void client.invalidateQueries({ queryKey: keys.stats })
  void client.invalidateQueries({ queryKey: keys.activity })
}

/** Undo one optimistic change, then refetch: a sibling mutation may have landed meanwhile. */
function rollback(client: QueryClient, titleId: string, previous: LibraryEntry | undefined) {
  restoreEntry(client, titleId, previous)
  void client.invalidateQueries({ queryKey: keys.library })
}

export interface EntryChange {
  entry: LibraryEntry
  statusChanged: { from: Status; to: Status } | null
}

function provisionalEntry(title: TitleRecord, status: Status): LibraryEntry {
  const now = new Date().toISOString()
  return {
    titleId: title.id,
    kind: title.kind,
    status,
    rating: null,
    favorite: false,
    notes: '',
    progress: status === 'completed' && title.kind !== 'game' ? 100 : 0,
    platform: null,
    store: null,
    hours: null,
    watchedEpisodes: 0,
    totalEpisodes: title.episodes ?? null,
    nextEpisode: null,
    addedAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    position: -Date.now(),
    playthroughs: [],
    title,
  }
}

export function useAddEntry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ title, status }: { title: TitleRecord; status?: Status; favorite?: boolean }) =>
      api<EntryChange & { created: boolean }>('POST', '/library', { titleId: title.id, status }),
    onMutate: async ({ title, status = 'planned' }) => {
      await client.cancelQueries({ queryKey: keys.library })
      const existing = client
        .getQueryData<LibraryEntry[]>(keys.library)
        ?.find((entry) => entry.titleId === title.id)
      setEntry(client, existing ? { ...existing, status } : provisionalEntry(title, status))
      return { existing }
    },
    onError: (_error, { title }, context) => rollback(client, title.id, context?.existing),
    onSuccess: ({ entry }) => {
      setEntry(client, entry)
      invalidateDerived(client)
    },
  })
}

export function useUpdateEntry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ titleId, patch }: { titleId: string; patch: EntryPatch }) =>
      api<EntryChange>('PATCH', `/library/${titleId}`, patch),
    onMutate: async ({ titleId, patch }) => {
      await client.cancelQueries({ queryKey: keys.library })
      const existing = client
        .getQueryData<LibraryEntry[]>(keys.library)
        ?.find((entry) => entry.titleId === titleId)
      const optimistic: Partial<LibraryEntry> = {}
      for (const key of [
        'status',
        'rating',
        'favorite',
        'notes',
        'progress',
        'platform',
        'store',
        'hours',
        'position',
      ] as const)
        if (patch[key] !== undefined) Object.assign(optimistic, { [key]: patch[key] })
      patchEntry(client, titleId, optimistic)
      return { existing }
    },
    onError: (_error, { titleId }, context) => rollback(client, titleId, context?.existing),
    onSuccess: ({ entry }, { titleId }) => {
      setEntry(client, entry)
      invalidateDerived(client)
      if (entry.kind === 'series' || entry.kind === 'anime')
        void client.invalidateQueries({ queryKey: keys.marks(titleId) })
    },
  })
}

export function useRemoveEntry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (titleId: string) => api<{ ok: true }>('DELETE', `/library/${titleId}`),
    onMutate: async (titleId) => {
      await client.cancelQueries({ queryKey: keys.library })
      const existing = client
        .getQueryData<LibraryEntry[]>(keys.library)
        ?.find((entry) => entry.titleId === titleId)
      client.setQueryData<LibraryEntry[]>(keys.library, (old) =>
        old?.filter((entry) => entry.titleId !== titleId),
      )
      return { existing }
    },
    onError: (_error, titleId, context) => rollback(client, titleId, context?.existing),
    onSuccess: (_data, titleId) => {
      client.removeQueries({ queryKey: keys.marks(titleId) })
      invalidateDerived(client)
    },
  })
}

export function useEpisodeMarks(titleId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.marks(titleId),
    queryFn: ({ signal }) =>
      get<{ marks: EpisodeMark[] }>(`/library/${titleId}/episodes`, signal).then(
        (data) => data.marks,
      ),
    enabled,
  })
}

type MarksResponse = EntryChange & { marks: EpisodeMark[] }

export function useMarkEpisodes() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      titleId,
      episodes,
      watched,
    }: {
      titleId: string
      episodes: { season: number; number: number }[]
      watched: boolean
    }) => api<MarksResponse>('POST', `/library/${titleId}/episodes`, { episodes, watched }),
    onMutate: async ({ titleId, episodes, watched }) => {
      await client.cancelQueries({ queryKey: keys.marks(titleId) })
      const previous = client.getQueryData<EpisodeMark[]>(keys.marks(titleId))
      const now = new Date().toISOString()
      const byKey = new Map((previous ?? []).map((mark) => [`${mark.season}:${mark.number}`, mark]))
      for (const e of episodes) {
        const key = `${e.season}:${e.number}`
        const mark = byKey.get(key) ?? {
          season: e.season,
          number: e.number,
          watchedAt: null,
          rating: null,
          note: '',
        }
        byKey.set(key, { ...mark, watchedAt: watched ? (mark.watchedAt ?? now) : null })
      }
      client.setQueryData(keys.marks(titleId), [...byKey.values()])
      return { previous }
    },
    onError: (_error, { titleId }, context) =>
      client.setQueryData(keys.marks(titleId), context?.previous),
    onSuccess: (data, { titleId }) => {
      client.setQueryData(keys.marks(titleId), data.marks)
      setEntry(client, data.entry)
      invalidateDerived(client)
    },
  })
}

export function useMarkNext() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (titleId: string) =>
      api<MarksResponse>('POST', `/library/${titleId}/episodes/next`),
    onSuccess: (data, titleId) => {
      client.setQueryData(keys.marks(titleId), data.marks)
      setEntry(client, data.entry)
      invalidateDerived(client)
    },
  })
}

export function useEpisodeNote() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      titleId,
      ...input
    }: {
      titleId: string
      season: number
      number: number
      note?: string
      rating?: number | null
    }) => api<{ marks: EpisodeMark[] }>('PUT', `/library/${titleId}/episodes/note`, input),
    onSuccess: (data, { titleId }) => client.setQueryData(keys.marks(titleId), data.marks),
  })
}

export function usePlaythroughs() {
  const client = useQueryClient()
  const onSuccess = ({ entry }: { entry: LibraryEntry }) => setEntry(client, entry)
  return {
    add: useMutation({
      mutationFn: ({ titleId, input }: { titleId: string; input: PlaythroughInput }) =>
        api<{ entry: LibraryEntry }>('POST', `/library/${titleId}/playthroughs`, input),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({
        titleId,
        id,
        patch,
      }: {
        titleId: string
        id: string
        patch: PlaythroughPatch
      }) => api<{ entry: LibraryEntry }>('PATCH', `/library/${titleId}/playthroughs/${id}`, patch),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: ({ titleId, id }: { titleId: string; id: string }) =>
        api<{ entry: LibraryEntry }>('DELETE', `/library/${titleId}/playthroughs/${id}`),
      onSuccess,
    }),
  }
}

export function useStats(enabled = true) {
  const user = useUser()
  return useQuery({
    queryKey: keys.stats,
    queryFn: ({ signal }) =>
      get<LibraryStats>(
        `/library/stats${query({
          tz: -new Date().getTimezoneOffset(),
          zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })}`,
        signal,
      ),
    enabled: Boolean(user) && enabled,
    staleTime: 30_000,
  })
}

export function useActivity(limit = 20) {
  const user = useUser()
  return useQuery({
    queryKey: [...keys.activity, limit],
    queryFn: ({ signal }) =>
      get<{ items: ActivityItem[] }>(`/library/activity${query({ limit })}`, signal).then(
        (d) => d.items,
      ),
    enabled: Boolean(user),
    staleTime: 30_000,
  })
}

export function useUserProfile(id: string | undefined) {
  const user = useUser()
  return useQuery({
    queryKey: keys.profile(id ?? ''),
    queryFn: ({ signal }) => get<UserProfile>(`/users/${id}/profile`, signal),
    enabled: Boolean(user) && Boolean(id),
    staleTime: 30_000,
    retry: (count, error) => count < 1 && (error as { status?: number }).status !== 404,
  })
}

// ---------------------------------------------------------------------------
// Catalog

export function useRegion() {
  return useUser()?.preferences.region ?? 'US'
}

export function useCharts(kind: Kind, list: ChartList, enabled = true) {
  const { locale } = useI18n()
  const region = useRegion()
  return useInfiniteQuery({
    queryKey: keys.charts(kind, list, locale, region),
    queryFn: ({ pageParam, signal }) =>
      get<ChartPage>(
        `/catalog/charts${query({ kind, list, page: pageParam, lang: locale, region })}`,
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      last.hasMore && pages.length < 20 ? pages.length + 1 : undefined,
    staleTime: 15 * 60_000,
    enabled,
  })
}

export function useSearch(q: string, kind: Kind | 'all') {
  const { locale } = useI18n()
  const trimmed = q.trim()
  return useQuery({
    queryKey: keys.search(trimmed.toLowerCase(), kind, locale),
    queryFn: ({ signal }) =>
      get<SearchResult>(`/catalog/search${query({ q: trimmed, kind, lang: locale })}`, signal),
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  })
}

export function useTitle(id: string, enabled = true) {
  const { locale } = useI18n()
  return useQuery({
    queryKey: keys.title(id, locale),
    queryFn: ({ signal }) =>
      get<{ title: TitleRecord }>(`/titles/${id}${query({ lang: locale })}`, signal).then(
        (d) => d.title,
      ),
    staleTime: 10 * 60_000,
    enabled,
    retry: (count, error) => count < 1 && !(error as { status?: number }).status,
  })
}

export function useEpisodeList(id: string, enabled: boolean) {
  const { locale } = useI18n()
  return useQuery({
    queryKey: keys.episodes(id),
    queryFn: ({ signal }) =>
      get<{ list: EpisodeList | null }>(
        `/titles/${id}/episodes${query({ lang: locale })}`,
        signal,
      ).then((d) => d.list),
    enabled,
    staleTime: 30 * 60_000,
  })
}

export function useOffers(id: string, enabled: boolean) {
  const region = useRegion()
  return useQuery({
    queryKey: keys.offers(id, region),
    queryFn: ({ signal }) =>
      get<{ offers: StoreOffer[] }>(`/titles/${id}/offers${query({ region })}`, signal).then(
        (d) => d.offers,
      ),
    enabled,
    staleTime: 30 * 60_000,
  })
}

export interface SteamAchievement {
  name: string
  displayName: string
  icon: string | null
  percent: number
}

export function useAchievements(appid: string | null) {
  const { locale } = useI18n()
  return useQuery({
    queryKey: ['achievements', appid, locale] as const,
    queryFn: ({ signal }) =>
      get<{ achievements: SteamAchievement[] }>(
        `/catalog/steam/${appid}/achievements${query({ lang: locale })}`,
        signal,
      ).then((d) => d.achievements),
    enabled: Boolean(appid),
    staleTime: 60 * 60_000,
  })
}
