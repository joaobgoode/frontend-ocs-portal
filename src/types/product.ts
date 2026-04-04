export interface Product {
  id: string
  nome: string
}

export function parseProduct(raw: unknown): Product {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Produto inválido.')
  }
  const o = raw as Record<string, unknown>
  const id = o.id
  const nome = o.nome
  if (typeof id !== 'string' || typeof nome !== 'string') {
    throw new Error('Produto: id ou nome inválido.')
  }
  return { id, nome }
}
