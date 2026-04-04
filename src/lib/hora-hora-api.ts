import { apiJson } from '@/lib/api-client'
import type { HoraHoraPayload, HoraHoraRow } from '@/types/hora-hora'
import { parseHoraHoraRow } from '@/types/hora-hora'

export interface HoraHoraQuery {
  data?: string
  data_inicio?: string
  data_fim?: string
  maquina?: string
}

function toQuery(p: HoraHoraQuery): Record<string, string | undefined> {
  return {
    data: p.data,
    data_inicio: p.data_inicio,
    data_fim: p.data_fim,
    maquina: p.maquina,
  }
}

export async function fetchHoraHoras(
  params: HoraHoraQuery = {},
): Promise<HoraHoraRow[]> {
  const raw = await apiJson<unknown>('GET', '/api/hora-hora', {
    query: toQuery(params),
  })
  if (!Array.isArray(raw)) {
    throw new Error('Lista hora a hora inválida.')
  }
  return raw.map((row) => parseHoraHoraRow(row))
}

export async function fetchHoraHoraById(id: string): Promise<HoraHoraRow> {
  const raw = await apiJson<unknown>('GET', `/api/hora-hora/${id}`)
  return parseHoraHoraRow(raw)
}

export async function createHoraHora(
  body: HoraHoraPayload,
): Promise<HoraHoraRow> {
  const raw = await apiJson<unknown>('POST', '/api/hora-hora', { body })
  return parseHoraHoraRow(raw)
}

export async function updateHoraHora(
  id: string,
  body: Partial<HoraHoraPayload>,
): Promise<HoraHoraRow> {
  const raw = await apiJson<unknown>('PATCH', `/api/hora-hora/${id}`, {
    body,
  })
  return parseHoraHoraRow(raw)
}

export async function deleteHoraHora(id: string): Promise<void> {
  await apiJson<void>('DELETE', `/api/hora-hora/${id}`)
}
