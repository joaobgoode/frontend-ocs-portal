import type { Maquina } from '@/types/user-permission'
import { isMaquina } from '@/types/user-permission'

export const TIPO_PARADA = Object.freeze({
  OPERACIONAL: 'operacional',
  MECANICA: 'mecânica',
  ELETRICA: 'elétrica',
  EXTERNA: 'externa',
  PREVENTIVA: 'preventiva',
} as const)

export type TipoParada = (typeof TIPO_PARADA)[keyof typeof TIPO_PARADA]

const TIPO_VALUES = new Set<string>(Object.values(TIPO_PARADA))

function isTipoParada(v: string): v is TipoParada {
  return TIPO_VALUES.has(v)
}

export interface ParadaResponsavelRef {
  id: string
  nome: string | null
}

export interface ParadaRow {
  id: string
  data: string
  turno: string | null
  maquina: Maquina
  horaInicio: string | null
  horaFim: string | null
  responsavelId: string | null
  tipo: TipoParada
  conjunto: string | null
  equipamento: string | null
  peca: string | null
  descricao: string | null
  resolvido: boolean
  responsavel?: ParadaResponsavelRef | null
}

export interface ParadaPayload {
  data: string
  maquina: Maquina
  tipo: TipoParada
  turno?: string | null
  horaInicio?: string | null
  horaFim?: string | null
  responsavelId?: string | null
  conjunto?: string | null
  equipamento?: string | null
  peca?: string | null
  descricao?: string | null
  resolvido?: boolean
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

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null || v === '') {
    return null
  }
  return String(v)
}

function parseResponsavel(raw: unknown): ParadaResponsavelRef | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string') {
    return null
  }
  return {
    id: o.id,
    nome: strOrNull(o.nome),
  }
}

export function parseParadaRow(raw: unknown): ParadaRow {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Parada inválida.')
  }
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string') {
    throw new Error('Parada sem id.')
  }
  const data = pick(o, 'data', 'data')
  if (typeof data !== 'string') {
    throw new Error('Parada sem data.')
  }
  const maq = pick(o, 'maquina', 'maquina')
  if (typeof maq !== 'string' || !isMaquina(maq)) {
    throw new Error('Parada: máquina inválida.')
  }
  const tipoRaw = pick(o, 'tipo', 'tipo')
  if (typeof tipoRaw !== 'string' || !isTipoParada(tipoRaw)) {
    throw new Error('Parada: tipo inválido.')
  }
  const resolvidoRaw = pick(o, 'resolvido', 'resolvido')
  const resolvido =
    resolvidoRaw === true ||
    resolvidoRaw === 1 ||
    resolvidoRaw === 'true' ||
    resolvidoRaw === '1'
  const rid = pick(o, 'responsavelId', 'responsavel_id')
  return {
    id: o.id,
    data,
    turno: strOrNull(pick(o, 'turno', 'turno')),
    maquina: maq,
    horaInicio: strOrNull(pick(o, 'horaInicio', 'hora_inicio')),
    horaFim: strOrNull(pick(o, 'horaFim', 'hora_fim')),
    responsavelId:
      rid === undefined || rid === null ? null : String(rid),
    tipo: tipoRaw,
    conjunto: strOrNull(pick(o, 'conjunto', 'conjunto')),
    equipamento: strOrNull(pick(o, 'equipamento', 'equipamento')),
    peca: strOrNull(pick(o, 'peca', 'peca')),
    descricao: strOrNull(pick(o, 'descricao', 'descricao')),
    resolvido,
    responsavel: parseResponsavel(o.responsavel),
  }
}
