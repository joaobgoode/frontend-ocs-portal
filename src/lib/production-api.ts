import { apiJson } from '@/lib/api-client'
import { parseOperadorListItem } from '@/types/operador'
import { parseProduct } from '@/types/product'
import type { ProductionPayload, ProductionRow } from '@/types/production'
import { parseProductionRow } from '@/types/production'

export interface ProducoesQuery {
  data?: string
  data_inicio?: string
  data_fim?: string
  produto?: string
  maquina?: string
  operador?: string
  resistencia?: string
  pigmentacao?: string
  lote?: string
}

function toQuery(p: ProducoesQuery): Record<string, string | undefined> {
  return {
    data: p.data,
    data_inicio: p.data_inicio,
    data_fim: p.data_fim,
    produto: p.produto,
    maquina: p.maquina,
    operador: p.operador,
    resistencia: p.resistencia,
    pigmentacao: p.pigmentacao,
    lote: p.lote,
  }
}

export async function fetchProducoes(
  params: ProducoesQuery = {},
): Promise<ProductionRow[]> {
  const raw = await apiJson<unknown>('GET', '/api/producoes', {
    query: toQuery(params),
  })
  if (!Array.isArray(raw)) {
    throw new Error('Lista de produções inválida.')
  }
  return raw.map((row) => parseProductionRow(row))
}

export async function fetchProducaoById(id: string): Promise<ProductionRow> {
  const raw = await apiJson<unknown>('GET', `/api/producoes/${id}`)
  return parseProductionRow(raw)
}

export async function fetchProdutos() {
  const raw = await apiJson<unknown>('GET', '/api/produtos')
  if (!Array.isArray(raw)) {
    throw new Error('Lista de produtos inválida.')
  }
  return raw.map((x) => parseProduct(x))
}

export async function fetchOperadores() {
  const raw = await apiJson<unknown>(
    'GET',
    '/api/user-permissions/operadores',
  )
  if (!Array.isArray(raw)) {
    throw new Error('Lista de operadores inválida.')
  }
  return raw.map((x) => parseOperadorListItem(x))
}

/** POST /api/producoes — cria produção (backend deve expor esta rota). */
export async function createProducao(
  body: ProductionPayload,
): Promise<ProductionRow> {
  const raw = await apiJson<unknown>('POST', '/api/producoes', { body })
  return parseProductionRow(raw)
}

/** PATCH /api/producoes/:id — atualiza produção (backend deve expor esta rota). */
export async function updateProducao(
  id: string,
  body: Partial<ProductionPayload>,
): Promise<ProductionRow> {
  const raw = await apiJson<unknown>('PATCH', `/api/producoes/${id}`, {
    body,
  })
  return parseProductionRow(raw)
}

/** DELETE /api/producoes/:id — remove produção (backend deve expor esta rota). */
export async function deleteProducao(id: string): Promise<void> {
  await apiJson<void>('DELETE', `/api/producoes/${id}`)
}
