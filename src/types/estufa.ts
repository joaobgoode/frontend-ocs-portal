import type { Maquina } from '@/types/user-permission'
import { isMaquina } from '@/types/user-permission'

export interface EstufaProdutoRef {
  id: string
  nome: string
}

export interface EstufaOperadorRef {
  id: string
  nome: string | null
  maquina?: Maquina | null
}

export interface EstufaRow {
  id: string
  data: string
  turno: string | null
  maquina: Maquina | null
  operadorId: string | null
  numero: string | null
  produtoId: string
  resistencia: string | null
  placas: number | null
  pecasProduzidas: number | null
  horaLiberacao: string | null
  lote: string | null
  dataPaletizacao: string | null
  turnoPaletizacao: string | null
  horaPaletizacao: string | null
  pecasPaletizadas: number | null
  paletesUsados: number | null
  naoConforme: number | null
  sucata: number | null
  produto?: EstufaProdutoRef | null
  operador?: EstufaOperadorRef | null
}

function pick(
  o: Record<string, unknown>,
  camel: string,
  snake: string,
): unknown {
  if (o[camel] !== undefined) {
    return o[camel]
  }
  return o[snake]
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') {
    return null
  }
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function intOrNull(v: unknown): number | null {
  const n = numOrNull(v)
  if (n === null) {
    return null
  }
  return Math.trunc(n)
}

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null || v === '') {
    return null
  }
  return String(v)
}

function parseProdutoRef(raw: unknown): EstufaProdutoRef | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.nome !== 'string') {
    return null
  }
  return { id: o.id, nome: o.nome }
}

function parseOperadorRef(raw: unknown): EstufaOperadorRef | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string') {
    return null
  }
  const nome = strOrNull(o.nome)
  let maquina: Maquina | null | undefined
  if (o.maquina != null && typeof o.maquina === 'string' && isMaquina(o.maquina)) {
    maquina = o.maquina
  }
  return { id: o.id, nome, maquina: maquina ?? null }
}

export function parseEstufaRow(raw: unknown): EstufaRow {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Estufa inválida.')
  }
  const o = raw as Record<string, unknown>

  const id = o.id
  if (typeof id !== 'string') {
    throw new Error('Estufa sem id.')
  }

  const data = pick(o, 'data', 'data')
  if (typeof data !== 'string') {
    throw new Error('Estufa sem data.')
  }

  const produtoIdRaw = pick(o, 'produtoId', 'produto_id')
  if (typeof produtoIdRaw !== 'string') {
    throw new Error('Estufa sem produto.')
  }

  const operadorIdRaw = pick(o, 'operadorId', 'operador_id')

  const maquinaRaw = pick(o, 'maquina', 'maquina')
  let maquina: Maquina | null = null
  if (
    typeof maquinaRaw === 'string' &&
    maquinaRaw.length > 0 &&
    isMaquina(maquinaRaw)
  ) {
    maquina = maquinaRaw
  }

  return {
    id,
    data,
    turno: strOrNull(pick(o, 'turno', 'turno')),
    maquina,
    operadorId:
      operadorIdRaw === undefined || operadorIdRaw === null
        ? null
        : String(operadorIdRaw),
    numero: strOrNull(pick(o, 'numero', 'numero')),
    produtoId: produtoIdRaw,
    resistencia: strOrNull(pick(o, 'resistencia', 'resistencia')),
    placas: intOrNull(pick(o, 'placas', 'placas')),
    pecasProduzidas: intOrNull(
      pick(o, 'pecasProduzidas', 'pecas_produzidas'),
    ),
    horaLiberacao: strOrNull(pick(o, 'horaLiberacao', 'hora_liberacao')),
    lote: strOrNull(pick(o, 'lote', 'lote')),
    dataPaletizacao: strOrNull(
      pick(o, 'dataPaletizacao', 'data_paletizacao'),
    ),
    turnoPaletizacao: strOrNull(
      pick(o, 'turnoPaletizacao', 'turno_paletizacao'),
    ),
    horaPaletizacao: strOrNull(
      pick(o, 'horaPaletizacao', 'hora_paletizacao'),
    ),
    pecasPaletizadas: intOrNull(
      pick(o, 'pecasPaletizadas', 'pecas_paletizadas'),
    ),
    paletesUsados: intOrNull(pick(o, 'paletesUsados', 'paletes_usados')),
    naoConforme: intOrNull(pick(o, 'naoConforme', 'nao_conforme')),
    sucata: numOrNull(pick(o, 'sucata', 'sucata')),
    produto: parseProdutoRef(o.produto),
    operador: parseOperadorRef(o.operador),
  }
}

export interface EstufaPayload {
  data: string
  produtoId: string
  turno?: string | null
  maquina?: Maquina | null
  operadorId?: string | null
  numero?: string | null
  resistencia?: string | null
  placas?: number | null
  pecasProduzidas?: number | null
  horaLiberacao?: string | null
  lote?: string | null
  dataPaletizacao?: string | null
  turnoPaletizacao?: string | null
  horaPaletizacao?: string | null
  pecasPaletizadas?: number | null
  paletesUsados?: number | null
  naoConforme?: number | null
  sucata?: number | null
}
