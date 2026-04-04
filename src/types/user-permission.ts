/** Alinhado ao modelo Sequelize `UserPermission` / tabela `user_permissions`. */

export const PRODUCAO_PERMISSAO = Object.freeze({
  VISUALIZADOR: 'visualizador',
  EDITOR: 'editor',
  ADMIN: 'admin',
} as const)

export const MAQUINA = Object.freeze({
  VP300: 'VP300',
  VP500: 'VP500',
  NOVABLOC: 'NOVABLOC',
} as const)

export type ProducaoPermissao =
  (typeof PRODUCAO_PERMISSAO)[keyof typeof PRODUCAO_PERMISSAO]

export type Maquina = (typeof MAQUINA)[keyof typeof MAQUINA]

export interface UserPermission {
  /** Mesmo UUID do usuário no Supabase Auth */
  id: string
  nome: string | null
  maquina: Maquina | null
  /** Coluna DB: `permissao_producao` */
  permissaoProducao: ProducaoPermissao
  /** Coluna DB: `permissao_paradas` — default visualizador se ausente na API */
  permissaoParadas: ProducaoPermissao
  /** Coluna DB: `permissao_estufa` — default visualizador se ausente na API */
  permissaoEstufa: ProducaoPermissao
  /** Ex.: `operador` quando existir na API */
  cargo?: string | null
  turno?: string | null
}

const PRODUCAO_VALUES = new Set<string>(Object.values(PRODUCAO_PERMISSAO))
const MAQUINA_VALUES = new Set<string>(Object.values(MAQUINA))

function isProducaoPermissao(v: string): v is ProducaoPermissao {
  return PRODUCAO_VALUES.has(v)
}

export function isMaquina(v: string): v is Maquina {
  return MAQUINA_VALUES.has(v)
}

export function canEditProducao(
  p: UserPermission | null | undefined,
): boolean {
  if (!p) {
    return false
  }
  return (
    p.permissaoProducao === PRODUCAO_PERMISSAO.EDITOR ||
    p.permissaoProducao === PRODUCAO_PERMISSAO.ADMIN
  )
}

export function canDeleteProducao(
  p: UserPermission | null | undefined,
): boolean {
  if (!p) {
    return false
  }
  return p.permissaoProducao === PRODUCAO_PERMISSAO.ADMIN
}

/** Normaliza cargo para comparação (ex.: manutenção → manutencao). */
export function slugCargo(cargo: string | null | undefined): string {
  const s = cargo == null ? '' : String(cargo).trim()
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function isCargoManutencao(cargo: string | null | undefined): boolean {
  return slugCargo(cargo) === 'manutencao'
}

/** Operador ou manutenção (aceita acentos em “manutenção”). */
export function isCargoOperadorOuManutencao(
  cargo: string | null | undefined,
): boolean {
  const c = slugCargo(cargo)
  return c === 'operador' || c === 'manutencao'
}

export function isCargoOperador(cargo: string | null | undefined): boolean {
  return slugCargo(cargo) === 'operador'
}

export function canEditParadas(
  p: UserPermission | null | undefined,
): boolean {
  if (!p) {
    return false
  }
  return (
    p.permissaoParadas === PRODUCAO_PERMISSAO.EDITOR ||
    p.permissaoParadas === PRODUCAO_PERMISSAO.ADMIN
  )
}

export function canDeleteParadas(
  p: UserPermission | null | undefined,
): boolean {
  if (!p) {
    return false
  }
  return p.permissaoParadas === PRODUCAO_PERMISSAO.ADMIN
}

export function canEditEstufa(
  p: UserPermission | null | undefined,
): boolean {
  if (!p) {
    return false
  }
  return (
    p.permissaoEstufa === PRODUCAO_PERMISSAO.EDITOR ||
    p.permissaoEstufa === PRODUCAO_PERMISSAO.ADMIN
  )
}

export function canDeleteEstufa(
  p: UserPermission | null | undefined,
): boolean {
  if (!p) {
    return false
  }
  return p.permissaoEstufa === PRODUCAO_PERMISSAO.ADMIN
}

/** Normaliza JSON da API (camelCase ou snake_case) para `UserPermission`. */
export function parseUserPermission(raw: unknown): UserPermission {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Resposta de permissões inválida.')
  }
  const o = raw as Record<string, unknown>

  const id = o.id
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Permissões: id ausente ou inválido.')
  }

  const permissaoRaw = o.permissaoProducao ?? o.permissao_producao
  if (typeof permissaoRaw !== 'string' || !isProducaoPermissao(permissaoRaw)) {
    throw new Error('Permissões: permissaoProducao inválida ou ausente.')
  }

  const nome =
    o.nome === undefined || o.nome === null
      ? null
      : String(o.nome)

  let maquina: Maquina | null = null
  if (o.maquina !== undefined && o.maquina !== null) {
    if (typeof o.maquina !== 'string' || !isMaquina(o.maquina)) {
      throw new Error('Permissões: maquina inválida.')
    }
    maquina = o.maquina
  }

  const cargoRaw = o.cargo
  const cargo =
    cargoRaw === undefined || cargoRaw === null ? null : String(cargoRaw)

  const turnoRaw = o.turno
  const turno =
    turnoRaw === undefined || turnoRaw === null ? null : String(turnoRaw)

  const ppRaw = o.permissaoParadas ?? o.permissao_paradas
  let permissaoParadas: ProducaoPermissao = PRODUCAO_PERMISSAO.VISUALIZADOR
  if (typeof ppRaw === 'string' && isProducaoPermissao(ppRaw)) {
    permissaoParadas = ppRaw
  }

  const peRaw = o.permissaoEstufa ?? o.permissao_estufa
  let permissaoEstufa: ProducaoPermissao = PRODUCAO_PERMISSAO.VISUALIZADOR
  if (typeof peRaw === 'string' && isProducaoPermissao(peRaw)) {
    permissaoEstufa = peRaw
  }

  return {
    id,
    nome,
    maquina,
    permissaoProducao: permissaoRaw,
    permissaoParadas,
    permissaoEstufa,
    cargo,
    turno,
  }
}
