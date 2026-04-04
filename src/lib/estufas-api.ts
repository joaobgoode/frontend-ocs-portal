import { apiJson } from '@/lib/api-client'
import type { EstufaPayload, EstufaRow } from '@/types/estufa'
import { parseEstufaRow } from '@/types/estufa'

export interface EstufasQuery {
  data?: string
  data_inicio?: string
  data_fim?: string
  maquina?: string
  produto?: string
  operador?: string
  lote?: string
  turno?: string
  numero?: string
}

function toQuery(p: EstufasQuery): Record<string, string | undefined> {
  return {
    data: p.data,
    data_inicio: p.data_inicio,
    data_fim: p.data_fim,
    maquina: p.maquina,
    produto: p.produto,
    operador: p.operador,
    lote: p.lote,
    turno: p.turno,
    numero: p.numero,
  }
}

export async function fetchEstufas(
  params: EstufasQuery = {},
): Promise<EstufaRow[]> {
  const raw = await apiJson<unknown>('GET', '/api/estufas', {
    query: toQuery(params),
  })
  if (!Array.isArray(raw)) {
    throw new Error('Lista de estufas inválida.')
  }
  return raw.map((row) => parseEstufaRow(row))
}

export async function fetchEstufaById(id: string): Promise<EstufaRow> {
  const raw = await apiJson<unknown>('GET', `/api/estufas/${id}`)
  return parseEstufaRow(raw)
}

export async function createEstufa(body: EstufaPayload): Promise<EstufaRow> {
  const raw = await apiJson<unknown>('POST', '/api/estufas', { body })
  return parseEstufaRow(raw)
}

export async function updateEstufa(
  id: string,
  body: Partial<EstufaPayload>,
): Promise<EstufaRow> {
  const raw = await apiJson<unknown>('PATCH', `/api/estufas/${id}`, {
    body,
  })
  return parseEstufaRow(raw)
}

export async function deleteEstufa(id: string): Promise<void> {
  await apiJson<void>('DELETE', `/api/estufas/${id}`)
}
