import { supabase } from '@/lib/supabase'
import { parseUserPermission, type UserPermission } from '@/types/user-permission'

function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!raw) {
    throw new Error('Defina VITE_API_BASE_URL no .env (URL do backend).')
  }
  return raw.replace(/\/$/, '')
}

function shouldLogPermissions(): boolean {
  const v = import.meta.env.VITE_DEBUG_PERMISSIONS?.toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

/** GET /api/user-permissions/me com Bearer do Supabase. */
export async function fetchMyUserPermissions(): Promise<UserPermission> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Sem sessão para consultar permissões.')
  }

  const res = await fetch(`${apiBaseUrl()}/api/user-permissions/me`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Permissões (${res.status}): ${text || res.statusText}`,
    )
  }

  const raw: unknown = await res.json()
  if (shouldLogPermissions()) {
    console.log('[VITE_DEBUG_PERMISSIONS] GET /api/user-permissions/me →', raw)
  }
  return parseUserPermission(raw)
}
