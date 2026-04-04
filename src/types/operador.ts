import type { Maquina } from '@/types/user-permission'
import { isMaquina } from '@/types/user-permission'

export interface OperadorListItem {
  id: string
  nome: string | null
  turno: string | null
  maquina: Maquina | null
}

export function parseOperadorListItem(raw: unknown): OperadorListItem {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Operador inválido.')
  }
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string') {
    throw new Error('Operador sem id.')
  }
  const nome =
    o.nome === undefined || o.nome === null ? null : String(o.nome)
  const turno =
    o.turno === undefined || o.turno === null ? null : String(o.turno)
  let maquina: Maquina | null = null
  if (o.maquina != null && typeof o.maquina === 'string' && isMaquina(o.maquina)) {
    maquina = o.maquina
  }
  return { id: o.id, nome, turno, maquina }
}
