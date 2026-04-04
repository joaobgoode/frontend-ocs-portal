<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, ChevronUp, Pencil } from 'lucide-vue-next'
import { usePermissionsStore } from '@/stores/permissions'
import {
  createProducao,
  deleteProducao,
  fetchOperadores,
  fetchProducaoById,
  fetchProducoes,
  fetchProdutos,
  updateProducao,
  type ProducoesQuery,
} from '@/lib/production-api'
import type { OperadorListItem } from '@/types/operador'
import type { ProductionPayload, ProductionRow } from '@/types/production'
import type { Maquina } from '@/types/user-permission'
import {
  MAQUINA,
  PRODUCAO_PERMISSAO,
  canDeleteProducao,
  canEditProducao,
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

const canEdit = computed(() =>
  canEditProducao(permissionsStore.permissions),
)

const canDelete = computed(() =>
  canDeleteProducao(permissionsStore.permissions),
)

const operadores = ref<OperadorListItem[]>([])

const filtersCollapsed = ref(false)

const filters = reactive({
  data: '',
  dataInicio: '',
  dataFim: '',
  lote: '',
  maquina: '',
  operador: '',
  turno: '',
  produto: '',
  resistencia: '',
})

const rows = ref<ProductionRow[]>([])
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
  operadorId: '',
  turno: '',
  lote: '',
  resistencia: '',
  pigmentacao: '',
  horimetroInicio: '',
  horimetroFim: '',
  horaInicio: '',
  horaFim: '',
  placasProduzidas: '',
  cimento: '',
  areia: '',
  britaNatasha: '',
  britaBasalto: '',
  poNatasha: '',
  poBasalto: '',
  aditivo: '',
})

function strTrim(v: unknown): string {
  if (v == null) {
    return ''
  }
  return String(v).trim()
}

const isCargoOperador = computed(() => {
  const p = permissionsStore.permissions
  if (!p) {
    return false
  }
  return strTrim(p.cargo).toLowerCase() === 'operador'
})

/** Quem pode abrir “Nova produção” (além de editor/admin). */
const isOperadorUsuario = computed(() => {
  const p = permissionsStore.permissions
  if (!p) {
    return false
  }
  if (isCargoOperador.value) {
    return true
  }
  if (p.permissaoProducao === PRODUCAO_PERMISSAO.VISUALIZADOR) {
    return true
  }
  return operadores.value.some((o) => o.id === p.id)
})

const canNovaProducao = computed(
  () => canEdit.value || isOperadorUsuario.value,
)

/**
 * Autocompletar máquina / turno / operador com GET /me quando `cargo` = operador.
 * Independe de `permissaoProducao` (operador pode ser admin no sistema e ainda ser de chão).
 */
const shouldAutofillOperadorCampos = computed(() => isCargoOperador.value)

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

function toPayload(): ProductionPayload {
  const data = strTrim(form.data)
  const produtoId = strTrim(form.produtoId)
  if (!data || !form.maquina || !produtoId) {
    throw new Error('Preencha data, máquina e produto.')
  }
  return {
    data,
    maquina: form.maquina as Maquina,
    produtoId,
    operadorId: strTrim(form.operadorId) || null,
    turno: strTrim(form.turno) || null,
    lote: strTrim(form.lote) || null,
    resistencia: strTrim(form.resistencia) || null,
    pigmentacao: strTrim(form.pigmentacao) || null,
    horimetroInicio: numOrUndef(form.horimetroInicio) ?? null,
    horimetroFim: numOrUndef(form.horimetroFim) ?? null,
    horaInicio: strTrim(form.horaInicio) || null,
    horaFim: strTrim(form.horaFim) || null,
    placasProduzidas: intOrUndef(form.placasProduzidas) ?? null,
    cimento: numOrUndef(form.cimento) ?? null,
    areia: numOrUndef(form.areia) ?? null,
    britaNatasha: numOrUndef(form.britaNatasha) ?? null,
    britaBasalto: numOrUndef(form.britaBasalto) ?? null,
    poNatasha: numOrUndef(form.poNatasha) ?? null,
    poBasalto: numOrUndef(form.poBasalto) ?? null,
    aditivo: numOrUndef(form.aditivo) ?? null,
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

function fillFormHoraInicioAgora() {
  form.horaInicio = nowLocalTimeHMS()
}

function fillFormHoraFimAgora() {
  form.horaFim = nowLocalTimeHMS()
}

function applyOperadorDefaults() {
  const p = permissionsStore.permissions
  if (!p || strTrim(p.cargo).toLowerCase() !== 'operador') {
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
  form.operadorId = ''
  form.turno = ''
  form.lote = ''
  form.resistencia = ''
  form.pigmentacao = ''
  form.horimetroInicio = ''
  form.horimetroFim = ''
  form.horaInicio = ''
  form.horaFim = ''
  form.placasProduzidas = ''
  form.cimento = ''
  form.areia = ''
  form.britaNatasha = ''
  form.britaBasalto = ''
  form.poNatasha = ''
  form.poBasalto = ''
  form.aditivo = ''
  formError.value = null
}

function openCreate() {
  resetForm()
  if (shouldAutofillOperadorCampos.value) {
    applyOperadorDefaults()
  }
  dialogOpen.value = true
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
  if (action !== 'novo-producao' && action !== 'edit-producao') {
    return
  }
  if (action === 'novo-producao') {
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
  if (action === 'edit-producao' && route.query.mapaId) {
    const id = String(route.query.mapaId)
    try {
      const row = await fetchProducaoById(id)
      openEdit(row)
    } catch {
      /* lista pode ser atualizada manualmente */
    }
    clearMapaQuery()
  }
}

function openEdit(row: ProductionRow) {
  editingId.value = row.id
  form.data = row.data
  form.maquina = row.maquina
  form.produtoId = row.produtoId
  form.operadorId = row.operadorId ?? ''
  form.turno = row.turno ?? ''
  form.lote = row.lote ?? ''
  form.resistencia = row.resistencia ?? ''
  form.pigmentacao = row.pigmentacao ?? ''
  form.horimetroInicio =
    row.horimetroInicio != null ? String(row.horimetroInicio) : ''
  form.horimetroFim = row.horimetroFim != null ? String(row.horimetroFim) : ''
  form.horaInicio = row.horaInicio ?? ''
  form.horaFim = row.horaFim ?? ''
  form.placasProduzidas =
    row.placasProduzidas != null ? String(row.placasProduzidas) : ''
  form.cimento = row.cimento != null ? String(row.cimento) : ''
  form.areia = row.areia != null ? String(row.areia) : ''
  form.britaNatasha =
    row.britaNatasha != null ? String(row.britaNatasha) : ''
  form.britaBasalto =
    row.britaBasalto != null ? String(row.britaBasalto) : ''
  form.poNatasha = row.poNatasha != null ? String(row.poNatasha) : ''
  form.poBasalto = row.poBasalto != null ? String(row.poBasalto) : ''
  form.aditivo = row.aditivo != null ? String(row.aditivo) : ''
  formError.value = null
  dialogOpen.value = true
}

function buildApiQuery(): ProducoesQuery {
  const q: ProducoesQuery = {}
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
  const maquina = strTrim(filters.maquina)
  if (maquina) {
    q.maquina = maquina
  }
  const operador = strTrim(filters.operador)
  if (operador) {
    q.operador = operador
  }
  const produto = strTrim(filters.produto)
  if (produto) {
    q.produto = produto
  }
  const resistencia = strTrim(filters.resistencia)
  if (resistencia) {
    q.resistencia = resistencia
  }
  return q
}

async function loadList() {
  listError.value = null
  loading.value = true
  try {
    let data = await fetchProducoes(buildApiQuery())
    const turnoF = strTrim(filters.turno)
    if (turnoF) {
      data = data.filter((r) => (r.turno ?? '') === turnoF)
    }
    rows.value = data
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
  filters.maquina = ''
  filters.operador = ''
  filters.turno = ''
  filters.produto = ''
  filters.resistencia = ''
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
      await updateProducao(editingId.value, payload)
    } else {
      await createProducao(payload)
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
    !confirm(
      'Excluir esta produção? Esta ação não pode ser desfeita.',
    )
  ) {
    return
  }
  formError.value = null
  deleting.value = true
  try {
    await deleteProducao(id)
    dialogOpen.value = false
    await loadList()
  } catch (e) {
    formError.value =
      e instanceof Error ? e.message : 'Não foi possível excluir.'
  } finally {
    deleting.value = false
  }
}

function fmtNum(n: number | null | undefined, maxFrac = 3) {
  if (n === null || n === undefined) {
    return '—'
  }
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: maxFrac,
  }).format(n)
}

/** Cimento / areia / brita natasha / brita basalto / pó natasha / pó basalto / aditivo */
function materiaisTraço(row: ProductionRow) {
  const parts = [
    fmtNum(row.cimento, 4),
    fmtNum(row.areia, 4),
    fmtNum(row.britaNatasha, 4),
    fmtNum(row.britaBasalto, 4),
    fmtNum(row.poNatasha, 4),
    fmtNum(row.poBasalto, 4),
    fmtNum(row.aditivo, 4),
  ]
  return parts.join('/')
}

onMounted(async () => {
  await loadCatalogs()
  await processMapaQuery()
  loadList()
})

watch(
  () => route.query.mapaAction,
  async (a) => {
    if (a === 'novo-producao' || a === 'edit-producao') {
      await processMapaQuery()
    }
  },
)
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 bg-background p-4 md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-lg font-semibold tracking-tight text-foreground">
        Produções
      </h1>
      <Button v-if="canNovaProducao" type="button" @click="openCreate">
        Nova produção
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
          <Label for="f-data">Data (dia)</Label>
          <Input
            id="f-data"
            v-model="filters.data"
            type="date"
            class="bg-background/50"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="f-ini">Data início</Label>
          <Input
            id="f-ini"
            v-model="filters.dataInicio"
            type="date"
            class="bg-background/50"
            :disabled="!!filters.data"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="f-fim">Data fim</Label>
          <Input
            id="f-fim"
            v-model="filters.dataFim"
            type="date"
            class="bg-background/50"
            :disabled="!!filters.data"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="f-lote">Lote</Label>
          <Input
            id="f-lote"
            v-model="filters.lote"
            class="bg-background/50"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="f-maq">Máquina</Label>
          <NativeSelect id="f-maq" v-model="filters.maquina" class="w-full">
            <NativeSelectOption value="">Todas</NativeSelectOption>
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
        <div class="space-y-1.5">
          <Label for="f-op">Operador</Label>
          <NativeSelect id="f-op" v-model="filters.operador" class="w-full">
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
          <Label for="f-turno">Turno</Label>
          <Input
            id="f-turno"
            v-model="filters.turno"
            class="bg-background/50"
            placeholder="Filtra na lista carregada"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="f-prod">Produto</Label>
          <NativeSelect id="f-prod" v-model="filters.produto" class="w-full">
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
        <div class="space-y-1.5">
          <Label for="f-res">Resistência</Label>
          <Input
            id="f-res"
            v-model="filters.resistencia"
            class="bg-background/50"
          />
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
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead>Data</TableHead>
            <TableHead>Máquina</TableHead>
            <TableHead>Lote</TableHead>
            <TableHead>Turno</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead>Operador</TableHead>
            <TableHead>Resist.</TableHead>
            <TableHead>Pigment.</TableHead>
            <TableHead class="text-right">Placas</TableHead>
            <TableHead
              class="min-w-[12rem] max-w-[28rem] text-xs font-normal leading-snug whitespace-normal"
            >
              Cimento / areia / brita natasha / brita basalto / pó natasha / pó
              basalto / aditivo
            </TableHead>
            <TableHead v-if="canEdit" class="w-[100px] text-right">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="canEdit ? 11 : 10" class="text-center">
              Carregando…
            </TableCell>
          </TableRow>
          <TableRow v-else-if="!rows.length">
            <TableCell :colspan="canEdit ? 11 : 10" class="text-center">
              Nenhuma produção encontrada.
            </TableCell>
          </TableRow>
          <TableRow v-for="row in rows" :key="row.id">
            <TableCell>{{ row.data }}</TableCell>
            <TableCell>{{ row.maquina }}</TableCell>
            <TableCell>{{ row.lote ?? '—' }}</TableCell>
            <TableCell>{{ row.turno ?? '—' }}</TableCell>
            <TableCell>{{ row.produto?.nome ?? '—' }}</TableCell>
            <TableCell>{{ row.operador?.nome ?? '—' }}</TableCell>
            <TableCell>{{ row.resistencia ?? '—' }}</TableCell>
            <TableCell>{{ row.pigmentacao ?? '—' }}</TableCell>
            <TableCell class="text-right">
              {{ row.placasProduzidas ?? '—' }}
            </TableCell>
            <TableCell
              class="max-w-[28rem] whitespace-normal break-all font-mono text-xs text-muted-foreground"
              :title="materiaisTraço(row)"
            >
              {{ materiaisTraço(row) }}
            </TableCell>
            <TableCell v-if="canEdit" class="text-right">
              <Button
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
        class="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>
            {{ editingId ? 'Editar produção' : 'Nova produção' }}
          </DialogTitle>
          <DialogDescription>
            Campos obrigatórios: data, máquina e produto.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-6">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="pf-data">Data</Label>
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
                id="pf-data"
                v-model="form.data"
                type="date"
                required
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="pf-maq">Máquina</Label>
              <NativeSelect id="pf-maq" v-model="form.maquina" class="w-full">
                <NativeSelectOption value="" disabled>
                  Selecione…
                </NativeSelectOption>
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
            <div class="space-y-1.5">
              <Label for="pf-op">Operador</Label>
              <NativeSelect id="pf-op" v-model="form.operadorId" class="w-full">
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
                  isCargoOperador &&
                  !editingId &&
                  permissionsStore.permissions?.nome
                "
                class="text-xs text-muted-foreground"
              >
                {{ permissionsStore.permissions.nome }}
              </p>
            </div>
            <div class="space-y-1.5">
              <Label for="pf-turno">Turno</Label>
              <Input
                id="pf-turno"
                v-model="form.turno"
                class="bg-background/50"
              />
            </div>
          </div>

          <Separator />

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="pf-lote">Lote</Label>
              <Input id="pf-lote" v-model="form.lote" class="bg-background/50" />
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="pf-prod">Produto</Label>
              <NativeSelect id="pf-prod" v-model="form.produtoId" class="w-full">
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
            <div class="space-y-1.5">
              <Label for="pf-res">Resistência</Label>
              <Input
                id="pf-res"
                v-model="form.resistencia"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="pf-pig">Pigmentação</Label>
              <Input
                id="pf-pig"
                v-model="form.pigmentacao"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="pf-hi">Horímetro início</Label>
              <Input
                id="pf-hi"
                v-model="form.horimetroInicio"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="pf-hf">Horímetro fim</Label>
              <Input
                id="pf-hf"
                v-model="form.horimetroFim"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="pf-ti">Hora início</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="h-7 shrink-0 px-2 text-xs"
                  @click="fillFormHoraInicioAgora"
                >
                  Agora
                </Button>
              </div>
              <Input
                id="pf-ti"
                v-model="form.horaInicio"
                type="time"
                step="1"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="pf-tf">Hora fim</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="h-7 shrink-0 px-2 text-xs"
                  @click="fillFormHoraFimAgora"
                >
                  Agora
                </Button>
              </div>
              <Input
                id="pf-tf"
                v-model="form.horaFim"
                type="time"
                step="1"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5 sm:col-span-2 sm:max-w-xs">
              <Label for="pf-placas">Placas produzidas</Label>
              <Input
                id="pf-placas"
                v-model="form.placasProduzidas"
                type="number"
                min="0"
                class="bg-background/50"
              />
            </div>
          </div>

          <Separator />

          <div class="space-y-3">
            <p
              class="text-xs font-medium text-muted-foreground leading-snug"
            >
              Traço
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="pf-cim">Cimento</Label>
                <Input
                  id="pf-cim"
                  v-model="form.cimento"
                  class="bg-background/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="pf-areia">Areia</Label>
                <Input
                  id="pf-areia"
                  v-model="form.areia"
                  class="bg-background/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="pf-bn">Brita Natasha</Label>
                <Input
                  id="pf-bn"
                  v-model="form.britaNatasha"
                  class="bg-background/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="pf-bb">Brita Basalto</Label>
                <Input
                  id="pf-bb"
                  v-model="form.britaBasalto"
                  class="bg-background/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="pf-pn">Pó Natasha</Label>
                <Input
                  id="pf-pn"
                  v-model="form.poNatasha"
                  class="bg-background/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="pf-pb">Pó Basalto</Label>
                <Input
                  id="pf-pb"
                  v-model="form.poBasalto"
                  class="bg-background/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="pf-ad">Aditivo</Label>
                <Input
                  id="pf-ad"
                  v-model="form.aditivo"
                  class="bg-background/50"
                />
              </div>
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
