import type { Maquina } from '@/types/user-permission'
import { isMaquina } from '@/types/user-permission'

export interface EquipeManutencaoItem {
  id: string
  nome: string | null
  turno: string | null
  maquina: Maquina | null
  cargo: string | null
}

export function parseEquipeManutencaoItem(raw: unknown): EquipeManutencaoItem {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Membro de equipe inválido.')
  }
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string') {
    throw new Error('Equipe: id ausente.')
  }
  const nome =
    o.nome === undefined || o.nome === null ? null : String(o.nome)
  const turno =
    o.turno === undefined || o.turno === null ? null : String(o.turno)
  const cargo =
    o.cargo === undefined || o.cargo === null ? null : String(o.cargo)
  let maquina: Maquina | null = null
  if (o.maquina != null && typeof o.maquina === 'string' && isMaquina(o.maquina)) {
    maquina = o.maquina
  }
  return { id: o.id, nome, turno, maquina, cargo }
}
