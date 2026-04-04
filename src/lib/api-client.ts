import { supabase } from '@/lib/supabase'

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!raw) {
    throw new Error('Defina VITE_API_BASE_URL no .env (URL do backend).')
  }
  return raw.replace(/\/$/, '')
}

export async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Não autenticado.')
  }
  return session.access_token
}

export async function apiJson<T>(
  method: string,
  path: string,
  options?: {
    query?: Record<string, string | undefined>
    body?: unknown
  },
): Promise<T> {
  const base = getApiBaseUrl()
  const pathNorm = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${base}${pathNorm}`)
  if (options?.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== '') {
        url.searchParams.set(k, v)
      }
    }
  }
  const token = await getAccessToken()
  const hasBody = options?.body !== undefined
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text || res.statusText}`)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}
