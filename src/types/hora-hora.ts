import type { Maquina } from '@/types/user-permission'
import { isMaquina } from '@/types/user-permission'

/** Registro alinhado ao modelo `HoraHora` / tabela `hora_hora`. */
export interface HoraHoraRow {
  id: string
  data: string
  maquina: Maquina
  /** Hora inicial do intervalo [hora, hora+1h). */
  hora: string
  placasProduzidas: number | null
  meta: number | null
  comentario: string | null
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

function intOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') {
    return null
  }
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) {
    return null
  }
  return Math.trunc(n)
}

/** Normaliza hora da API (TIME) para HH:MM:SS (hora com 2 dígitos). */
function normalizeHora(v: unknown): string {
  if (v == null) {
    return ''
  }
  const s = String(v).trim()
  if (!s) {
    return ''
  }
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (!m) {
    return s
  }
  const h = String(Number(m[1])).padStart(2, '0')
  const min = m[2]
  const sec = m[3] != null ? m[3] : '00'
  return `${h}:${min}:${sec.padStart(2, '0')}`
}

export function parseHoraHoraRow(raw: unknown): HoraHoraRow {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Registro hora a hora inválido.')
  }
  const o = raw as Record<string, unknown>

  const id = o.id
  if (typeof id !== 'string') {
    throw new Error('Hora a hora sem id.')
  }

  const data = pick(o, 'data', 'data')
  if (typeof data !== 'string') {
    throw new Error('Hora a hora sem data.')
  }

  const maquinaRaw = pick(o, 'maquina', 'maquina')
  if (typeof maquinaRaw !== 'string' || !isMaquina(maquinaRaw)) {
    throw new Error('Hora a hora: máquina inválida.')
  }

  const horaRaw = pick(o, 'hora', 'hora')
  const hora = normalizeHora(horaRaw)
  if (!hora) {
    throw new Error('Hora a hora sem hora.')
  }

  return {
    id,
    data,
    maquina: maquinaRaw,
    hora,
    placasProduzidas: intOrNull(
      pick(o, 'placasProduzidas', 'placas_produzidas'),
    ),
    meta: intOrNull(pick(o, 'meta', 'meta')),
    comentario: strOrNull(pick(o, 'comentario', 'comentario')),
  }
}

export interface HoraHoraPayload {
  data: string
  maquina: Maquina
  hora: string
  placasProduzidas?: number | null
  meta?: number | null
  comentario?: string | null
}

/** Fim do intervalo de 1h após `hora` (formato alinhado ao input time). */
export function horaFimIntervalo(hora: string): string {
  const t = hora.trim()
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t)
  if (!m) {
    return '—'
  }
  let h = Number(m[1])
  const min = Number(m[2])
  const sec = m[3] != null ? Number(m[3]) : 0
  h = (h + 1) % 24
  const pad = (n: number) => String(n).padStart(2, '0')
  if (m[3] != null) {
    return `${pad(h)}:${pad(min)}:${pad(sec)}`
  }
  return `${pad(h)}:${pad(min)}`
}

/** Ex.: 16:00:00 → 16:00 para exibição curta. */
export function fmtHoraCurta(hora: string): string {
  const t = hora.trim()
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t)
  const hh = m?.[1]
  const mm = m?.[2]
  if (hh == null || mm == null) {
    return hora
  }
  return `${hh.padStart(2, '0')}:${mm}`
}

export function labelIntervaloHora(hora: string): string {
  const ini = fmtHoraCurta(hora)
  const fim = fmtHoraCurta(horaFimIntervalo(hora))
  return `${ini} – ${fim}`
}

/** Ordena por hora (string TIME do mesmo dia). */
export function compareHoraHoraRows(a: HoraHoraRow, b: HoraHoraRow): number {
  return a.hora.localeCompare(b.hora)
}
