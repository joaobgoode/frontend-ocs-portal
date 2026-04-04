import { apiJson } from '@/lib/api-client'
import { parseEquipeManutencaoItem } from '@/types/equipe-manutencao'
import type { ParadaPayload, ParadaRow } from '@/types/parada'
import { parseParadaRow } from '@/types/parada'

export interface ParadasQuery {
  data?: string
  data_inicio?: string
  data_fim?: string
  maquina?: string
  tipo?: string
  turno?: string
  responsavel?: string
  resolvido?: string
}

function toParadasQuery(p: ParadasQuery): Record<string, string | undefined> {
  return {
    data: p.data,
    data_inicio: p.data_inicio,
    data_fim: p.data_fim,
    maquina: p.maquina,
    tipo: p.tipo,
    turno: p.turno,
    responsavel: p.responsavel,
    resolvido: p.resolvido,
  }
}

export async function fetchParadas(
  params: ParadasQuery = {},
): Promise<ParadaRow[]> {
  const raw = await apiJson<unknown>('GET', '/api/paradas', {
    query: toParadasQuery(params),
  })
  if (!Array.isArray(raw)) {
    throw new Error('Lista de paradas inválida.')
  }
  return raw.map((row) => parseParadaRow(row))
}

export async function fetchParadaById(id: string): Promise<ParadaRow> {
  const raw = await apiJson<unknown>('GET', `/api/paradas/${id}`)
  return parseParadaRow(raw)
}

export async function fetchEquipeManutencao() {
  const raw = await apiJson<unknown>('GET', '/api/manutencao/equipe')
  if (!Array.isArray(raw)) {
    throw new Error('Lista da equipe de manutenção inválida.')
  }
  return raw.map((x) => parseEquipeManutencaoItem(x))
}

export async function createParada(body: ParadaPayload): Promise<ParadaRow> {
  const raw = await apiJson<unknown>('POST', '/api/paradas', { body })
  return parseParadaRow(raw)
}

export async function updateParada(
  id: string,
  body: Partial<ParadaPayload>,
): Promise<ParadaRow> {
  const raw = await apiJson<unknown>('PATCH', `/api/paradas/${id}`, {
    body,
  })
  return parseParadaRow(raw)
}

export async function deleteParada(id: string): Promise<void> {
  await apiJson<void>('DELETE', `/api/paradas/${id}`)
}
