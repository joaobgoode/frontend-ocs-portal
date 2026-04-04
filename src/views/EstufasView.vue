<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, ChevronUp, Pencil } from 'lucide-vue-next'
import { usePermissionsStore } from '@/stores/permissions'
import {
  createEstufa,
  deleteEstufa,
  fetchEstufaById,
  fetchEstufas,
  updateEstufa,
  type EstufasQuery,
} from '@/lib/estufas-api'
import {
  fetchOperadores,
  fetchProdutos,
} from '@/lib/production-api'
import type { OperadorListItem } from '@/types/operador'
import type { EstufaPayload, EstufaRow } from '@/types/estufa'
import type { Maquina } from '@/types/user-permission'
import {
  MAQUINA,
  PRODUCAO_PERMISSAO,
  canDeleteEstufa,
  canEditEstufa,
  isCargoOperador,
  isMaquina,
} from '@/types/user-permission'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const permissionsStore = usePermissionsStore()
const route = useRoute()
const router = useRouter()

const canEdit = computed(() => canEditEstufa(permissionsStore.permissions))
const canDelete = computed(() =>
  canDeleteEstufa(permissionsStore.permissions),
)

const operadores = ref<OperadorListItem[]>([])

const filtersCollapsed = ref(false)

const filters = reactive({
  data: '',
  dataInicio: '',
  dataFim: '',
  lote: '',
  operador: '',
  turno: '',
  produto: '',
  numero: '',
})

const rows = ref<EstufaRow[]>([])
const loading = ref(false)
const listError = ref<string | null>(null)

const produtos = ref<{ id: string; nome: string }[]>([])
const catalogsError = ref<string | null>(null)

const dialogOpen = ref(false)
const saving = ref(false)
const deleting = ref(false)
const formError = ref<string | null>(null)
const editingId = ref<string | null>(null)

const form = reactive({
  data: '',
  maquina: '' as Maquina | '',
  produtoId: '',
  resistencia: '',
  operadorId: '',
  turno: '',
  numero: '',
  placas: '',
  pecasProduzidas: '',
  horaLiberacao: '',
  lote: '',
  dataPaletizacao: '',
  turnoPaletizacao: '',
  horaPaletizacao: '',
  pecasPaletizadas: '',
  paletesUsados: '',
  naoConforme: '',
  sucata: '',
})

function strTrim(v: unknown): string {
  if (v == null) {
    return ''
  }
  return String(v).trim()
}

const shouldAutofillOperadorCampos = computed(() =>
  isCargoOperador(permissionsStore.permissions?.cargo),
)

const isOperadorEstufaUsuario = computed(() => {
  const p = permissionsStore.permissions
  if (!p) {
    return false
  }
  if (isCargoOperador(p.cargo)) {
    return true
  }
  if (p.permissaoEstufa === PRODUCAO_PERMISSAO.VISUALIZADOR) {
    return true
  }
  return operadores.value.some((o) => o.id === p.id)
})

const canNovaEstufa = computed(
  () => canEdit.value || isOperadorEstufaUsuario.value,
)

const canSalvarModal = computed(() =>
  editingId.value ? canEdit.value : canNovaEstufa.value,
)

function numOrUndef(v: unknown): number | null | undefined {
  const t = strTrim(v)
  if (!t) {
    return null
  }
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

function intOrUndef(v: unknown): number | null | undefined {
  const n = numOrUndef(v)
  if (n === undefined) {
    return undefined
  }
  if (n === null) {
    return null
  }
  return Math.trunc(n)
}

function toPayload(): EstufaPayload {
  const data = strTrim(form.data)
  const produtoId = strTrim(form.produtoId)
  if (!data || !produtoId) {
    throw new Error('Preencha data e produto.')
  }
  return {
    data,
    produtoId,
    maquina: form.maquina ? (form.maquina as Maquina) : null,
    resistencia: strTrim(form.resistencia) || null,
    operadorId: strTrim(form.operadorId) || null,
    turno: strTrim(form.turno) || null,
    numero: strTrim(form.numero) || null,
    placas: intOrUndef(form.placas) ?? null,
    pecasProduzidas: intOrUndef(form.pecasProduzidas) ?? null,
    horaLiberacao: strTrim(form.horaLiberacao) || null,
    lote: strTrim(form.lote) || null,
    dataPaletizacao: strTrim(form.dataPaletizacao) || null,
    turnoPaletizacao: strTrim(form.turnoPaletizacao) || null,
    horaPaletizacao: strTrim(form.horaPaletizacao) || null,
    pecasPaletizadas: intOrUndef(form.pecasPaletizadas) ?? null,
    paletesUsados: intOrUndef(form.paletesUsados) ?? null,
    naoConforme: intOrUndef(form.naoConforme) ?? null,
    sucata: numOrUndef(form.sucata) ?? null,
  }
}

function todayLocalISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nowLocalTimeHMS(): string {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${min}:${s}`
}

function fillFormDataHoje() {
  form.data = todayLocalISODate()
}

function fillFormHoraLiberacaoAgora() {
  form.horaLiberacao = nowLocalTimeHMS()
}

function fillFormHoraPaletizacaoAgora() {
  form.horaPaletizacao = nowLocalTimeHMS()
}

function applyOperadorDefaults() {
  const p = permissionsStore.permissions
  if (!p || !isCargoOperador(p.cargo)) {
    return
  }
  form.operadorId = p.id
  if (p.maquina) {
    form.maquina = p.maquina
  }
  const t = strTrim(p.turno)
  if (t) {
    form.turno = t
  }
}

function resetForm() {
  editingId.value = null
  form.data = ''
  form.maquina = ''
  form.produtoId = ''
  form.resistencia = ''
  form.operadorId = ''
  form.turno = ''
  form.numero = ''
  form.placas = ''
  form.pecasProduzidas = ''
  form.horaLiberacao = ''
  form.lote = ''
  form.dataPaletizacao = ''
  form.turnoPaletizacao = ''
  form.horaPaletizacao = ''
  form.pecasPaletizadas = ''
  form.paletesUsados = ''
  form.naoConforme = ''
  form.sucata = ''
  formError.value = null
}

function clearMapaQuery() {
  const q = { ...route.query }
  delete q.mapaAction
  delete q.mapaData
  delete q.mapaMaq
  delete q.mapaId
  void router.replace({ query: q })
}

async function processMapaQuery() {
  const action = route.query.mapaAction
  if (action !== 'novo-estufa' && action !== 'edit-estufa') {
    return
  }
  if (action === 'novo-estufa') {
    resetForm()
    const d = strTrim(route.query.mapaData)
    const mq = route.query.mapaMaq
    if (d) {
      form.data = d
    }
    if (typeof mq === 'string' && isMaquina(mq)) {
      form.maquina = mq
    }
    if (shouldAutofillOperadorCampos.value) {
      applyOperadorDefaults()
    }
    dialogOpen.value = true
    clearMapaQuery()
    return
  }
  if (action === 'edit-estufa' && route.query.mapaId) {
    const id = String(route.query.mapaId)
    try {
      const row = await fetchEstufaById(id)
      openEdit(row)
    } catch {
      /* ignorar */
    }
    clearMapaQuery()
  }
}

function openCreate() {
  resetForm()
  if (shouldAutofillOperadorCampos.value) {
    applyOperadorDefaults()
  }
  dialogOpen.value = true
}

function openEdit(row: EstufaRow) {
  editingId.value = row.id
  form.data = row.data
  form.maquina = row.maquina ?? ''
  form.produtoId = row.produtoId
  form.resistencia = row.resistencia ?? ''
  form.operadorId = row.operadorId ?? ''
  form.turno = row.turno ?? ''
  form.numero = row.numero ?? ''
  form.placas = row.placas != null ? String(row.placas) : ''
  form.pecasProduzidas =
    row.pecasProduzidas != null ? String(row.pecasProduzidas) : ''
  form.horaLiberacao = row.horaLiberacao ?? ''
  form.lote = row.lote ?? ''
  form.dataPaletizacao = row.dataPaletizacao ?? ''
  form.turnoPaletizacao = row.turnoPaletizacao ?? ''
  form.horaPaletizacao = row.horaPaletizacao ?? ''
  form.pecasPaletizadas =
    row.pecasPaletizadas != null ? String(row.pecasPaletizadas) : ''
  form.paletesUsados =
    row.paletesUsados != null ? String(row.paletesUsados) : ''
  form.naoConforme =
    row.naoConforme != null ? String(row.naoConforme) : ''
  form.sucata = row.sucata != null ? String(row.sucata) : ''
  formError.value = null
  dialogOpen.value = true
}

function buildApiQuery(): EstufasQuery {
  const q: EstufasQuery = {}
  const data = strTrim(filters.data)
  if (data) {
    q.data = data
  } else {
    const di = strTrim(filters.dataInicio)
    const df = strTrim(filters.dataFim)
    if (di) {
      q.data_inicio = di
    }
    if (df) {
      q.data_fim = df
    }
  }
  const lote = strTrim(filters.lote)
  if (lote) {
    q.lote = lote
  }
  const operador = strTrim(filters.operador)
  if (operador) {
    q.operador = operador
  }
  const produto = strTrim(filters.produto)
  if (produto) {
    q.produto = produto
  }
  const turno = strTrim(filters.turno)
  if (turno) {
    q.turno = turno
  }
  const numero = strTrim(filters.numero)
  if (numero) {
    q.numero = numero
  }
  return q
}

async function loadList() {
  listError.value = null
  loading.value = true
  try {
    rows.value = await fetchEstufas(buildApiQuery())
  } catch (e) {
    listError.value = e instanceof Error ? e.message : 'Erro ao carregar.'
    rows.value = []
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  filters.data = ''
  filters.dataInicio = ''
  filters.dataFim = ''
  filters.lote = ''
  filters.operador = ''
  filters.turno = ''
  filters.produto = ''
  filters.numero = ''
}

async function loadCatalogs() {
  catalogsError.value = null
  try {
    const [p, o] = await Promise.all([fetchProdutos(), fetchOperadores()])
    produtos.value = p
    operadores.value = o
  } catch (e) {
    catalogsError.value =
      e instanceof Error ? e.message : 'Erro ao carregar listas.'
  }
}

async function onSave() {
  formError.value = null
  saving.value = true
  try {
    const payload = toPayload()
    if (editingId.value) {
      await updateEstufa(editingId.value, payload)
    } else {
      await createEstufa(payload)
    }
    dialogOpen.value = false
    await loadList()
  } catch (e) {
    formError.value =
      e instanceof Error ? e.message : 'Não foi possível salvar.'
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  const id = editingId.value
  if (!id) {
    return
  }
  if (
    !confirm('Excluir este registro de estufa? Esta ação não pode ser desfeita.')
  ) {
    return
  }
  formError.value = null
  deleting.value = true
  try {
    await deleteEstufa(id)
    dialogOpen.value = false
    await loadList()
  } catch (e) {
    formError.value =
      e instanceof Error ? e.message : 'Não foi possível excluir.'
  } finally {
    deleting.value = false
  }
}

/** Sempre 14 colunas de dados + Ações (botão só se canEdit). */
const tableColspan = 15

function parseDataHora(isoDate: string, hora: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim())
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(hora.trim())
  if (!dm || !tm) {
    return null
  }
  const y = Number(dm[1])
  const mo = Number(dm[2])
  const d = Number(dm[3])
  const h = Number(tm[1])
  const mi = Number(tm[2])
  const s = tm[3] != null ? Number(tm[3]) : 0
  const dt = new Date(y, mo - 1, d, h, mi, s)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function formatTempoEstufa(row: EstufaRow): string {
  const hiS = strTrim(row.horaLiberacao)
  const hfS = strTrim(row.horaPaletizacao)
  if (!hiS || !hfS) {
    return '—'
  }
  const dIni = row.data
  const dFim = row.dataPaletizacao ?? row.data
  const t0 = parseDataHora(dIni, hiS)
  const t1 = parseDataHora(dFim, hfS)
  if (!t0 || !t1) {
    return '—'
  }
  const ms = t1.getTime() - t0.getTime()
  if (ms < 0) {
    return '—'
  }
  const sec = Math.floor(ms / 1000)
  const days = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (days > 0) {
    return `${days}d ${h}h ${m}min`
  }
  if (h > 0) {
    return `${h}h ${m}min`
  }
  if (m > 0) {
    return `${m}min`
  }
  return '<1 min'
}

function formatPerdas(row: EstufaRow): string {
  const a = row.pecasProduzidas
  const b = row.pecasPaletizadas
  if (a == null || b == null) {
    return '—'
  }
  return String(a - b)
}

function fmtSucataTable(n: number | null | undefined): string {
  if (n === null || n === undefined) {
    return '—'
  }
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 4,
  }).format(n)
}

function fmtHoraCurta(v: string | null | undefined): string {
  const s = strTrim(v)
  if (!s) {
    return '—'
  }
  const m = /^(\d{1,2}:\d{2})/.exec(s)
  return m?.[1] ?? s
}

onMounted(async () => {
  await loadCatalogs()
  await processMapaQuery()
  loadList()
})

watch(
  () => route.query.mapaAction,
  async (a) => {
    if (a === 'novo-estufa' || a === 'edit-estufa') {
      await processMapaQuery()
    }
  },
)
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 bg-background p-4 md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-lg font-semibold tracking-tight text-foreground">
        Estufas
      </h1>
      <Button v-if="canNovaEstufa" type="button" @click="openCreate">
        Nova estufa
      </Button>
    </div>

    <p v-if="catalogsError" class="text-sm text-destructive">
      {{ catalogsError }}
    </p>

    <Card class="border-border">
      <CardHeader
        class="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3"
      >
        <CardTitle class="text-base">Filtros</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="shrink-0 gap-1.5"
          @click="filtersCollapsed = !filtersCollapsed"
        >
          <ChevronUp v-if="!filtersCollapsed" class="size-4" />
          <ChevronDown v-else class="size-4" />
          {{ filtersCollapsed ? 'Expandir' : 'Recolher' }}
        </Button>
      </CardHeader>
      <CardContent
        v-show="!filtersCollapsed"
        class="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
      >
        <div class="space-y-1.5">
          <Label for="ef-data">Data (dia)</Label>
          <Input
            id="ef-data"
            v-model="filters.data"
            type="date"
            class="bg-background/50"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="ef-ini">Data início</Label>
          <Input
            id="ef-ini"
            v-model="filters.dataInicio"
            type="date"
            class="bg-background/50"
            :disabled="!!filters.data"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="ef-fim">Data fim</Label>
          <Input
            id="ef-fim"
            v-model="filters.dataFim"
            type="date"
            class="bg-background/50"
            :disabled="!!filters.data"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="ef-lote">Lote</Label>
          <Input id="ef-lote" v-model="filters.lote" class="bg-background/50" />
        </div>
        <div class="space-y-1.5">
          <Label for="ef-op">Operador</Label>
          <NativeSelect id="ef-op" v-model="filters.operador" class="w-full">
            <NativeSelectOption value="">Todos</NativeSelectOption>
            <NativeSelectOption
              v-for="op in operadores"
              :key="op.id"
              :value="op.id"
            >
              {{ op.nome || op.id }}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <div class="space-y-1.5">
          <Label for="ef-turno">Turno</Label>
          <Input
            id="ef-turno"
            v-model="filters.turno"
            class="bg-background/50"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="ef-num">Número</Label>
          <Input id="ef-num" v-model="filters.numero" class="bg-background/50" />
        </div>
        <div class="space-y-1.5">
          <Label for="ef-prod">Produto</Label>
          <NativeSelect id="ef-prod" v-model="filters.produto" class="w-full">
            <NativeSelectOption value="">Todos</NativeSelectOption>
            <NativeSelectOption
              v-for="pr in produtos"
              :key="pr.id"
              :value="pr.id"
            >
              {{ pr.nome }}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <div class="flex flex-wrap items-end gap-2 md:col-span-2 lg:col-span-4">
          <Button type="button" :disabled="loading" @click="loadList">
            Aplicar filtros
          </Button>
          <Button
            type="button"
            variant="outline"
            :disabled="loading"
            @click="
              clearFilters();
              loadList();
            "
          >
            Limpar
          </Button>
        </div>
      </CardContent>
    </Card>

    <p v-if="listError" class="text-sm text-destructive">{{ listError }}</p>

    <div class="overflow-x-auto rounded-md border border-border">
      <Table class="w-full table-auto text-sm">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-0 px-1.5 py-2 whitespace-nowrap">
              Data
            </TableHead>
            <TableHead class="w-0 px-1.5 py-2 whitespace-nowrap">
              Máquina
            </TableHead>
            <TableHead class="w-0 px-1.5 py-2 whitespace-nowrap">
              Nº
            </TableHead>
            <TableHead class="max-w-[5rem] px-1.5 py-2">Produto</TableHead>
            <TableHead class="w-0 px-1.5 py-2 whitespace-nowrap">
              Resist.
            </TableHead>
            <TableHead class="w-0 px-1.5 py-2 whitespace-nowrap">
              Liberação
            </TableHead>
            <TableHead class="w-0 px-1.5 py-2 whitespace-nowrap">
              Paletiz.
            </TableHead>
            <TableHead class="w-0 px-1.5 py-2 whitespace-nowrap">
              Tempo
            </TableHead>
            <TableHead class="px-1.5 py-2 text-right whitespace-nowrap">
              Peças prod.
            </TableHead>
            <TableHead class="px-1.5 py-2 text-right whitespace-nowrap">
              Peças pal.
            </TableHead>
            <TableHead class="px-1.5 py-2 text-right whitespace-nowrap">
              Paletes
            </TableHead>
            <TableHead class="px-1.5 py-2 text-right whitespace-nowrap">
              Não conf.
            </TableHead>
            <TableHead class="px-1.5 py-2 text-right whitespace-nowrap">
              Sucata
            </TableHead>
            <TableHead class="px-1.5 py-2 text-right whitespace-nowrap">
              Perdas
            </TableHead>
            <TableHead class="w-[100px] px-1.5 py-2 text-right whitespace-nowrap">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="tableColspan" class="text-center">
              Carregando…
            </TableCell>
          </TableRow>
          <TableRow v-else-if="!rows.length">
            <TableCell :colspan="tableColspan" class="text-center">
              Nenhum registro encontrado.
            </TableCell>
          </TableRow>
          <TableRow v-for="row in rows" :key="row.id">
            <TableCell class="px-1.5 py-1.5 whitespace-nowrap">
              {{ row.data }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 whitespace-nowrap">
              {{ row.maquina ?? '—' }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 whitespace-nowrap">
              {{ row.numero ?? '—' }}
            </TableCell>
            <TableCell
              class="max-w-[5rem] truncate px-1.5 py-1.5"
              :title="row.produto?.nome ?? undefined"
            >
              {{ row.produto?.nome ?? '—' }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 whitespace-nowrap">
              {{ row.resistencia ?? '—' }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 whitespace-nowrap tabular-nums">
              {{ fmtHoraCurta(row.horaLiberacao) }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 whitespace-nowrap tabular-nums">
              {{ fmtHoraCurta(row.horaPaletizacao) }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 whitespace-nowrap text-muted-foreground">
              {{ formatTempoEstufa(row) }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 text-right tabular-nums">
              {{ row.pecasProduzidas ?? '—' }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 text-right tabular-nums">
              {{ row.pecasPaletizadas ?? '—' }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 text-right tabular-nums">
              {{ row.paletesUsados ?? '—' }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 text-right tabular-nums">
              {{ row.naoConforme ?? '—' }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 text-right tabular-nums">
              {{ fmtSucataTable(row.sucata) }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 text-right tabular-nums">
              {{ formatPerdas(row) }}
            </TableCell>
            <TableCell class="px-1.5 py-1.5 text-right">
              <Button
                v-if="canEdit"
                type="button"
                variant="ghost"
                size="icon"
                class="size-8"
                aria-label="Editar"
                @click="openEdit(row)"
              >
                <Pencil class="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="dialogOpen">
      <DialogContent
        class="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>
            {{ editingId ? 'Editar estufa' : 'Nova estufa' }}
          </DialogTitle>
          <DialogDescription>
            Campos obrigatórios: data e produto.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-6">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="esf-data">Data</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="h-7 shrink-0 px-2 text-xs"
                  @click="fillFormDataHoje"
                >
                  Hoje
                </Button>
              </div>
              <Input
                id="esf-data"
                v-model="form.data"
                type="date"
                required
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="esf-maq">Máquina</Label>
              <NativeSelect id="esf-maq" v-model="form.maquina" class="w-full">
                <NativeSelectOption value="">—</NativeSelectOption>
                <NativeSelectOption :value="MAQUINA.VP300">
                  {{ MAQUINA.VP300 }}
                </NativeSelectOption>
                <NativeSelectOption :value="MAQUINA.VP500">
                  {{ MAQUINA.VP500 }}
                </NativeSelectOption>
                <NativeSelectOption :value="MAQUINA.NOVABLOC">
                  {{ MAQUINA.NOVABLOC }}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="esf-prod">Produto</Label>
              <NativeSelect id="esf-prod" v-model="form.produtoId" class="w-full">
                <NativeSelectOption value="" disabled>
                  Selecione…
                </NativeSelectOption>
                <NativeSelectOption
                  v-for="pr in produtos"
                  :key="pr.id"
                  :value="pr.id"
                >
                  {{ pr.nome }}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="esf-res">Resistência</Label>
              <Input
                id="esf-res"
                v-model="form.resistencia"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="esf-op">Operador</Label>
              <NativeSelect id="esf-op" v-model="form.operadorId" class="w-full">
                <NativeSelectOption value="">—</NativeSelectOption>
                <NativeSelectOption
                  v-for="op in operadores"
                  :key="op.id"
                  :value="op.id"
                >
                  {{ op.nome || op.id }}
                </NativeSelectOption>
              </NativeSelect>
              <p
                v-if="
                  shouldAutofillOperadorCampos &&
                  !editingId &&
                  permissionsStore.permissions?.nome
                "
                class="text-xs text-muted-foreground"
              >
                {{ permissionsStore.permissions.nome }}
              </p>
            </div>
            <div class="space-y-1.5">
              <Label for="esf-turno">Turno</Label>
              <Input
                id="esf-turno"
                v-model="form.turno"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="esf-num">Número</Label>
              <Input id="esf-num" v-model="form.numero" class="bg-background/50" />
            </div>
          </div>

          <Separator />

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="esf-placas">Placas</Label>
              <Input
                id="esf-placas"
                v-model="form.placas"
                inputmode="numeric"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="esf-pec">Peças produzidas</Label>
              <Input
                id="esf-pec"
                v-model="form.pecasProduzidas"
                inputmode="numeric"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="esf-hlib">Hora liberação</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="h-7 shrink-0 px-2 text-xs"
                  @click="fillFormHoraLiberacaoAgora"
                >
                  Agora
                </Button>
              </div>
              <Input
                id="esf-hlib"
                v-model="form.horaLiberacao"
                type="time"
                step="1"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="esf-lote">Lote</Label>
              <Input id="esf-lote" v-model="form.lote" class="bg-background/50" />
            </div>
          </div>

          <Separator />

          <p class="text-sm font-medium text-foreground">Paletização</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="esf-dpal">Data paletização</Label>
              <Input
                id="esf-dpal"
                v-model="form.dataPaletizacao"
                type="date"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="esf-tpal">Turno paletização</Label>
              <Input
                id="esf-tpal"
                v-model="form.turnoPaletizacao"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="esf-hpal">Hora paletização</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="h-7 shrink-0 px-2 text-xs"
                  @click="fillFormHoraPaletizacaoAgora"
                >
                  Agora
                </Button>
              </div>
              <Input
                id="esf-hpal"
                v-model="form.horaPaletizacao"
                type="time"
                step="1"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="esf-ppal">Peças paletizadas</Label>
              <Input
                id="esf-ppal"
                v-model="form.pecasPaletizadas"
                inputmode="numeric"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="esf-pal">Paletes usados</Label>
              <Input
                id="esf-pal"
                v-model="form.paletesUsados"
                inputmode="numeric"
                class="bg-background/50"
              />
            </div>
          </div>

          <Separator />

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="esf-nc">Não conforme</Label>
              <Input
                id="esf-nc"
                v-model="form.naoConforme"
                inputmode="numeric"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="esf-suc">Sucata</Label>
              <Input
                id="esf-suc"
                v-model="form.sucata"
                inputmode="decimal"
                class="bg-background/50"
              />
            </div>
          </div>
        </div>

        <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>

        <DialogFooter
          class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-4"
        >
          <div class="flex sm:mr-auto">
            <Button
              v-if="canDelete && editingId"
              type="button"
              variant="destructive"
              :disabled="saving || deleting"
              @click="onDelete"
            >
              {{ deleting ? 'Excluindo…' : 'Excluir' }}
            </Button>
          </div>
          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button
              type="button"
              variant="outline"
              :disabled="saving || deleting"
              @click="dialogOpen = false"
            >
              Cancelar
            </Button>
            <Button
              v-if="canSalvarModal"
              type="button"
              :disabled="saving || deleting"
              @click="onSave"
            >
              {{ saving ? 'Salvando…' : 'Salvar' }}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
