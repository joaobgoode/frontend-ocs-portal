<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Clock, Pencil, Plus } from 'lucide-vue-next'
import {
  createHoraHora,
  deleteHoraHora,
  fetchHoraHoraById,
  fetchHoraHoras,
  updateHoraHora,
  type HoraHoraQuery,
} from '@/lib/hora-hora-api'
import { fetchOperadores } from '@/lib/production-api'
import { usePermissionsStore } from '@/stores/permissions'
import type { OperadorListItem } from '@/types/operador'
import type { HoraHoraPayload, HoraHoraRow } from '@/types/hora-hora'
import {
  compareHoraHoraRows,
  horaFimIntervalo,
  labelIntervaloHora,
} from '@/types/hora-hora'
import type { Maquina } from '@/types/user-permission'
import {
  MAQUINA,
  PRODUCAO_PERMISSAO,
  canDeleteProducao,
  canEditProducao,
} from '@/types/user-permission'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function strTrim(v: unknown): string {
  if (v == null) {
    return ''
  }
  return String(v).trim()
}

function todayLocalISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const permissionsStore = usePermissionsStore()

const canEdit = computed(() =>
  canEditProducao(permissionsStore.permissions),
)
const canDelete = computed(() =>
  canDeleteProducao(permissionsStore.permissions),
)

const operadores = ref<OperadorListItem[]>([])

const isCargoOperador = computed(() => {
  const p = permissionsStore.permissions
  if (!p) {
    return false
  }
  return String(p.cargo ?? '')
    .trim()
    .toLowerCase() === 'operador'
})

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

const canNova = computed(() => canEdit.value || isOperadorUsuario.value)

const filters = reactive({
  data: todayLocalISODate(),
  dataInicio: '',
  dataFim: '',
  maquina: '' as Maquina | '',
})

const rows = ref<HoraHoraRow[]>([])
const loading = ref(false)
const listError = ref<string | null>(null)

const dialogOpen = ref(false)
const saving = ref(false)
const deleting = ref(false)
const formError = ref<string | null>(null)
const editingId = ref<string | null>(null)

const form = reactive({
  data: '',
  maquina: '' as Maquina | '',
  hora: '',
  placasProduzidas: '',
  meta: '',
  comentario: '',
})

function intOrUndef(v: unknown): number | null | undefined {
  const t = strTrim(v)
  if (!t) {
    return null
  }
  const n = Number(t.replace(',', '.'))
  if (!Number.isFinite(n)) {
    return undefined
  }
  return Math.trunc(n)
}

/** Envia TIME com segundos para a API. */
function toApiHora(hora: string): string {
  const t = strTrim(hora)
  if (!t) {
    return ''
  }
  if (/^\d{2}:\d{2}$/.test(t)) {
    return `${t}:00`
  }
  return t
}

const horaFimPreview = computed(() => {
  const h = strTrim(form.hora)
  if (!h) {
    return '—'
  }
  return horaFimIntervalo(h)
})

const intervaloPreview = computed(() => {
  const h = strTrim(form.hora)
  if (!h) {
    return '—'
  }
  return labelIntervaloHora(h)
})

function toPayload(): HoraHoraPayload {
  const data = strTrim(form.data)
  const hora = toApiHora(form.hora)
  if (!data || !form.maquina || !hora) {
    throw new Error('Preencha data, máquina e hora inicial.')
  }
  return {
    data,
    maquina: form.maquina as Maquina,
    hora,
    placasProduzidas: intOrUndef(form.placasProduzidas) ?? null,
    meta: intOrUndef(form.meta) ?? null,
    comentario: strTrim(form.comentario) || null,
  }
}

function resetForm() {
  editingId.value = null
  form.data = ''
  form.maquina = ''
  form.hora = ''
  form.placasProduzidas = ''
  form.meta = ''
  form.comentario = ''
  formError.value = null
}

function applyOperadorDefaults() {
  const p = permissionsStore.permissions
  if (!p || !isCargoOperador.value) {
    return
  }
  if (p.maquina) {
    form.maquina = p.maquina
  }
}

function buildApiQuery(): HoraHoraQuery {
  const q: HoraHoraQuery = {}
  const data = strTrim(filters.data)
  const di = strTrim(filters.dataInicio)
  const df = strTrim(filters.dataFim)
  if (data) {
    q.data = data
  } else {
    if (di) {
      q.data_inicio = di
    }
    if (df) {
      q.data_fim = df
    }
  }
  const mq = strTrim(filters.maquina)
  if (mq) {
    q.maquina = mq
  }
  return q
}

async function loadList() {
  loading.value = true
  listError.value = null
  try {
    const list = await fetchHoraHoras(buildApiQuery())
    rows.value = [...list].sort(compareHoraHoraRows)
  } catch (e) {
    listError.value =
      e instanceof Error ? e.message : 'Não foi possível carregar.'
    rows.value = []
  } finally {
    loading.value = false
  }
}

const sortedRows = computed(() => [...rows.value].sort(compareHoraHoraRows))

type RowAugmented = HoraHoraRow & {
  placasN: number
  metaN: number
  diffHora: number
  acumPlacas: number
  acumMeta: number
  diffAcum: number
}

const rowsWithRunning = computed((): RowAugmented[] => {
  let acumP = 0
  let acumM = 0
  return sortedRows.value.map((r) => {
    const placasN = r.placasProduzidas ?? 0
    const metaN = r.meta ?? 0
    acumP += placasN
    acumM += metaN
    return {
      ...r,
      placasN,
      metaN,
      diffHora: placasN - metaN,
      acumPlacas: acumP,
      acumMeta: acumM,
      diffAcum: acumP - acumM,
    }
  })
})

const totalPlacas = computed(() =>
  sortedRows.value.reduce((s, r) => s + (r.placasProduzidas ?? 0), 0),
)
const totalMeta = computed(() =>
  sortedRows.value.reduce((s, r) => s + (r.meta ?? 0), 0),
)
const diffTotal = computed(() => totalPlacas.value - totalMeta.value)

function fmtSigned(n: number): string {
  if (n > 0) {
    return `+${n}`
  }
  return String(n)
}

function openCreate() {
  resetForm()
  form.data = strTrim(filters.data) || todayLocalISODate()
  const mq = strTrim(filters.maquina)
  if (mq && (mq === MAQUINA.VP300 || mq === MAQUINA.VP500 || mq === MAQUINA.NOVABLOC)) {
    form.maquina = mq
  }
  applyOperadorDefaults()
  dialogOpen.value = true
}

async function openEdit(row: HoraHoraRow) {
  resetForm()
  editingId.value = row.id
  try {
    const full = await fetchHoraHoraById(row.id)
    form.data = full.data
    form.maquina = full.maquina
    const h = full.hora.trim()
    form.hora = /^\d{2}:\d{2}:\d{2}$/.test(h) ? h.slice(0, 5) : h
    form.placasProduzidas =
      full.placasProduzidas != null ? String(full.placasProduzidas) : ''
    form.meta = full.meta != null ? String(full.meta) : ''
    form.comentario = full.comentario ?? ''
    dialogOpen.value = true
  } catch {
    formError.value = 'Não foi possível carregar o registro.'
    dialogOpen.value = true
  }
}

async function onSave() {
  if (!canEdit.value && !(!editingId.value && canNova.value)) {
    return
  }
  if (editingId.value && !canEdit.value) {
    return
  }
  formError.value = null
  saving.value = true
  try {
    const payload = toPayload()
    if (editingId.value) {
      await updateHoraHora(editingId.value, payload)
    } else {
      await createHoraHora(payload)
    }
    dialogOpen.value = false
    resetForm()
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
  if (!id || !canDelete.value) {
    return
  }
  if (
    !confirm(
      'Excluir este registro? Esta ação não pode ser desfeita.',
    )
  ) {
    return
  }
  formError.value = null
  deleting.value = true
  try {
    await deleteHoraHora(id)
    dialogOpen.value = false
    resetForm()
    await loadList()
  } catch (e) {
    formError.value =
      e instanceof Error ? e.message : 'Não foi possível excluir.'
  } finally {
    deleting.value = false
  }
}

watch(
  () => [filters.data, filters.dataInicio, filters.dataFim, filters.maquina],
  () => {
    void loadList()
  },
  { immediate: true },
)

onMounted(() => {
  void fetchOperadores()
    .then((r) => {
      operadores.value = r
    })
    .catch(() => {
      operadores.value = []
    })
})
</script>

<template>
  <div class="flex flex-1 flex-col gap-6 bg-background p-4 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-center gap-2">
        <div
          class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Clock class="size-5" />
        </div>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-foreground">
            Hora a hora
          </h1>
          <p class="text-sm text-muted-foreground">
            Produção por intervalo de 1 h (a hora informada é o início; o fim é
            preenchido automaticamente).
          </p>
        </div>
      </div>
      <Button
        v-if="canNova"
        type="button"
        class="gap-1.5"
        @click="openCreate"
      >
        <Plus class="size-4" />
        Novo
      </Button>
    </div>

    <Card class="border-border/80 shadow-sm">
      <CardHeader class="pb-3">
        <CardTitle class="text-base">Filtros</CardTitle>
        <CardDescription>
          Use um dia específico ou intervalo de datas; opcionalmente filtre por
          máquina.
        </CardDescription>
      </CardHeader>
      <CardContent
        class="flex flex-wrap items-end gap-4 border-t border-border/60 pt-4"
      >
        <div class="space-y-1.5">
          <Label for="hh-data">Dia</Label>
          <Input
            id="hh-data"
            v-model="filters.data"
            type="date"
            class="w-[min(100%,12rem)] bg-background/50"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="hh-di" class="text-muted-foreground">Data início</Label>
          <Input
            id="hh-di"
            v-model="filters.dataInicio"
            type="date"
            class="w-[min(100%,12rem)] bg-background/50"
            :disabled="!!strTrim(filters.data)"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="hh-df" class="text-muted-foreground">Data fim</Label>
          <Input
            id="hh-df"
            v-model="filters.dataFim"
            type="date"
            class="w-[min(100%,12rem)] bg-background/50"
            :disabled="!!strTrim(filters.data)"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="hh-maq">Máquina</Label>
          <NativeSelect
            id="hh-maq"
            v-model="filters.maquina"
            class="w-[min(100%,12rem)] min-w-[10rem]"
          >
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
        <Button
          type="button"
          variant="secondary"
          :disabled="loading"
          @click="loadList"
        >
          {{ loading ? 'Carregando…' : 'Atualizar' }}
        </Button>
      </CardContent>
    </Card>

    <div
      v-if="listError"
      class="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ listError }}
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card class="border-border/80 shadow-sm">
        <CardHeader class="pb-2">
          <CardDescription>Total placas (lista)</CardDescription>
          <CardTitle class="text-2xl tabular-nums">
            {{ loading ? '…' : totalPlacas }}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card class="border-border/80 shadow-sm">
        <CardHeader class="pb-2">
          <CardDescription>Total meta (soma dos intervalos)</CardDescription>
          <CardTitle class="text-2xl tabular-nums">
            {{ loading ? '…' : totalMeta }}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card class="border-border/80 shadow-sm">
        <CardHeader class="pb-2">
          <CardDescription>Diferença total (placas − meta)</CardDescription>
          <CardTitle
            class="text-2xl tabular-nums"
            :class="
              diffTotal > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : diffTotal < 0
                  ? 'text-destructive'
                  : ''
            "
          >
            {{ loading ? '…' : fmtSigned(diffTotal) }}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card class="border-border/80 shadow-sm">
        <CardHeader class="pb-2">
          <CardDescription>Registros</CardDescription>
          <CardTitle class="text-2xl tabular-nums">
            {{ loading ? '…' : sortedRows.length }}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>

    <Card class="border-border/80 shadow-sm">
      <CardHeader class="pb-3">
        <CardTitle class="text-base">Intervalos</CardTitle>
        <CardDescription>
          Acumulados na ordem cronológica da hora inicial.
        </CardDescription>
      </CardHeader>
      <CardContent class="border-t border-border/60 pt-4">
        <div class="overflow-x-auto rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Intervalo</TableHead>
                <TableHead class="text-right">Placas</TableHead>
                <TableHead class="text-right">Meta</TableHead>
                <TableHead class="text-right">Δ hora</TableHead>
                <TableHead class="text-right">Acum. placas</TableHead>
                <TableHead class="text-right">Acum. meta</TableHead>
                <TableHead class="text-right">Δ acum.</TableHead>
                <TableHead>Comentário</TableHead>
                <TableHead v-if="canEdit" class="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="!loading && !rowsWithRunning.length">
                <TableCell
                  :colspan="canEdit ? 9 : 8"
                  class="text-center text-muted-foreground"
                >
                  Nenhum registro para os filtros.
                </TableCell>
              </TableRow>
              <TableRow v-for="r in rowsWithRunning" :key="r.id">
                <TableCell class="whitespace-nowrap font-medium">
                  {{ labelIntervaloHora(r.hora) }}
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ r.placasProduzidas ?? '—' }}
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ r.meta ?? '—' }}
                </TableCell>
                <TableCell
                  class="text-right tabular-nums"
                  :class="
                    r.diffHora > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : r.diffHora < 0
                        ? 'text-destructive'
                        : ''
                  "
                >
                  {{ fmtSigned(r.diffHora) }}
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ r.acumPlacas }}
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ r.acumMeta }}
                </TableCell>
                <TableCell
                  class="text-right tabular-nums"
                  :class="
                    r.diffAcum > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : r.diffAcum < 0
                        ? 'text-destructive'
                        : ''
                  "
                >
                  {{ fmtSigned(r.diffAcum) }}
                </TableCell>
                <TableCell class="max-w-[12rem] truncate text-muted-foreground">
                  {{ r.comentario || '—' }}
                </TableCell>
                <TableCell v-if="canEdit" class="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="size-8"
                    @click="openEdit(r)"
                  >
                    <Pencil class="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {{ editingId ? 'Editar hora a hora' : 'Novo hora a hora' }}
          </DialogTitle>
          <DialogDescription>
            A hora é o início do intervalo de 1 hora.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4">
          <div class="space-y-1.5">
            <Label for="hh-f-data">Data</Label>
            <Input
              id="hh-f-data"
              v-model="form.data"
              type="date"
              required
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="hh-f-maq">Máquina</Label>
            <NativeSelect id="hh-f-maq" v-model="form.maquina" class="w-full">
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
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="hh-f-hi">Hora inicial</Label>
              <Input
                id="hh-f-hi"
                v-model="form.hora"
                type="time"
                step="3600"
                required
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="hh-f-hf">Hora final (automático)</Label>
              <input
                id="hh-f-hf"
                :value="horaFimPreview"
                type="text"
                readonly
                tabindex="-1"
                class="flex h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-1 text-sm shadow-xs outline-none md:text-sm"
              />
            </div>
          </div>
          <p v-if="strTrim(form.hora)" class="text-xs text-muted-foreground">
            Intervalo: {{ intervaloPreview }}
          </p>
          <div class="space-y-1.5">
            <Label for="hh-f-pl">Placas produzidas</Label>
            <Input
              id="hh-f-pl"
              v-model="form.placasProduzidas"
              inputmode="numeric"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="hh-f-meta">Meta (intervalo)</Label>
            <Input
              id="hh-f-meta"
              v-model="form.meta"
              inputmode="numeric"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="hh-f-com">Comentário</Label>
            <Input
              id="hh-f-com"
              v-model="form.comentario"
              class="bg-background/50"
            />
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
              v-if="editingId ? canEdit : canNova"
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
