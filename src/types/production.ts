import type { Maquina } from '@/types/user-permission'
import { isMaquina } from '@/types/user-permission'

export interface ProductionProdutoRef {
  id: string
  nome: string
}

export interface ProductionOperadorRef {
  id: string
  nome: string | null
  maquina?: Maquina | null
}

/** Produção alinhada ao modelo Sequelize `Production` + includes da API. */
export interface ProductionRow {
  id: string
  data: string
  maquina: Maquina
  operadorId: string | null
  turno: string | null
  lote: string | null
  produtoId: string
  resistencia: string | null
  pigmentacao: string | null
  horimetroInicio: number | null
  horimetroFim: number | null
  horaInicio: string | null
  horaFim: string | null
  placasProduzidas: number | null
  cimento: number | null
  areia: number | null
  britaNatasha: number | null
  britaBasalto: number | null
  poNatasha: number | null
  poBasalto: number | null
  aditivo: number | null
  produto?: ProductionProdutoRef | null
  operador?: ProductionOperadorRef | null
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
  const n = typeof v === 'number' ? v : Number(v)
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

function parseProdutoRef(raw: unknown): ProductionProdutoRef | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.nome !== 'string') {
    return null
  }
  return { id: o.id, nome: o.nome }
}

function parseOperadorRef(raw: unknown): ProductionOperadorRef | null {
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

export function parseProductionRow(raw: unknown): ProductionRow {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Produção inválida.')
  }
  const o = raw as Record<string, unknown>

  const id = o.id
  if (typeof id !== 'string') {
    throw new Error('Produção sem id.')
  }

  const data = pick(o, 'data', 'data')
  if (typeof data !== 'string') {
    throw new Error('Produção sem data.')
  }

  const maquinaRaw = pick(o, 'maquina', 'maquina')
  if (typeof maquinaRaw !== 'string' || !isMaquina(maquinaRaw)) {
    throw new Error('Produção: máquina inválida.')
  }

  const produtoIdRaw = pick(o, 'produtoId', 'produto_id')
  if (typeof produtoIdRaw !== 'string') {
    throw new Error('Produção sem produto.')
  }

  const operadorIdRaw = pick(o, 'operadorId', 'operador_id')

  return {
    id,
    data,
    maquina: maquinaRaw,
    operadorId:
      operadorIdRaw === undefined || operadorIdRaw === null
        ? null
        : String(operadorIdRaw),
    turno: strOrNull(pick(o, 'turno', 'turno')),
    lote: strOrNull(pick(o, 'lote', 'lote')),
    produtoId: produtoIdRaw,
    resistencia: strOrNull(pick(o, 'resistencia', 'resistencia')),
    pigmentacao: strOrNull(pick(o, 'pigmentacao', 'pigmentacao')),
    horimetroInicio: numOrNull(pick(o, 'horimetroInicio', 'horimetro_inicio')),
    horimetroFim: numOrNull(pick(o, 'horimetroFim', 'horimetro_fim')),
    horaInicio: strOrNull(pick(o, 'horaInicio', 'hora_inicio')),
    horaFim: strOrNull(pick(o, 'horaFim', 'hora_fim')),
    placasProduzidas: intOrNull(pick(o, 'placasProduzidas', 'placas_produzidas')),
    cimento: numOrNull(pick(o, 'cimento', 'cimento')),
    areia: numOrNull(pick(o, 'areia', 'areia')),
    britaNatasha: numOrNull(pick(o, 'britaNatasha', 'brita_natasha')),
    britaBasalto: numOrNull(pick(o, 'britaBasalto', 'brita_basalto')),
    poNatasha: numOrNull(pick(o, 'poNatasha', 'po_natasha')),
    poBasalto: numOrNull(pick(o, 'poBasalto', 'po_basalto')),
    aditivo: numOrNull(pick(o, 'aditivo', 'aditivo')),
    produto: parseProdutoRef(o.produto),
    operador: parseOperadorRef(o.operador),
  }
}

/** Payload JSON para POST/PATCH (camelCase, como no Sequelize). */
export interface ProductionPayload {
  data: string
  maquina: Maquina
  produtoId: string
  operadorId?: string | null
  turno?: string | null
  lote?: string | null
  resistencia?: string | null
  pigmentacao?: string | null
  horimetroInicio?: number | null
  horimetroFim?: number | null
  horaInicio?: string | null
  horaFim?: string | null
  placasProduzidas?: number | null
  cimento?: number | null
  areia?: number | null
  britaNatasha?: number | null
  britaBasalto?: number | null
  poNatasha?: number | null
  poBasalto?: number | null
  aditivo?: number | null
}
