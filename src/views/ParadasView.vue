<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, ChevronUp, Pencil } from 'lucide-vue-next'
import { usePermissionsStore } from '@/stores/permissions'
import {
  createParada,
  deleteParada,
  fetchEquipeManutencao,
  fetchParadaById,
  fetchParadas,
  updateParada,
  type ParadasQuery,
} from '@/lib/paradas-api'
import type { EquipeManutencaoItem } from '@/types/equipe-manutencao'
import type { ParadaPayload, ParadaRow, TipoParada } from '@/types/parada'
import { TIPO_PARADA } from '@/types/parada'
import type { Maquina } from '@/types/user-permission'
import {
  MAQUINA,
  canDeleteParadas,
  canEditParadas,
  isCargoOperadorOuManutencao,
  isMaquina,
  slugCargo,
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

const canEdit = computed(() => canEditParadas(permissionsStore.permissions))
const canDelete = computed(() =>
  canDeleteParadas(permissionsStore.permissions),
)

const equipe = ref<EquipeManutencaoItem[]>([])

const isNaEquipeManutencao = computed(() => {
  const p = permissionsStore.permissions
  if (!p) {
    return false
  }
  return equipe.value.some((m) => m.id === p.id)
})

const isEquipeManutencaoUsuario = computed(() => {
  const p = permissionsStore.permissions
  if (!p) {
    return false
  }
  if (isNaEquipeManutencao.value) {
    return true
  }
  const c = slugCargo(p.cargo)
  return c === 'operador' || c === 'manutencao'
})

const canNovaParada = computed(
  () => canEdit.value || isEquipeManutencaoUsuario.value,
)

const shouldAutofillOperadorOuManutencao = computed(() =>
  isCargoOperadorOuManutencao(permissionsStore.permissions?.cargo),
)

const canSalvarModal = computed(() =>
  editingId.value ? canEdit.value : canNovaParada.value,
)

const filtersCollapsed = ref(false)

const filters = reactive({
  data: '',
  dataInicio: '',
  dataFim: '',
  maquina: '',
  tipo: '',
  turno: '',
  responsavel: '',
  resolvido: '' as '' | 'true' | 'false',
})

const rows = ref<ParadaRow[]>([])
const loading = ref(false)
const listError = ref<string | null>(null)
const catalogsError = ref<string | null>(null)

const dialogOpen = ref(false)
const saving = ref(false)
const deleting = ref(false)
const formError = ref<string | null>(null)
const editingId = ref<string | null>(null)

const form = reactive({
  data: '',
  maquina: '' as Maquina | '',
  responsavelId: '',
  turno: '',
  tipo: '' as TipoParada | '',
  horaInicio: '',
  horaFim: '',
  resolvido: false,
  conjunto: '',
  equipamento: '',
  peca: '',
  descricao: '',
})

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

function toPayload(): ParadaPayload {
  const data = strTrim(form.data)
  if (!data || !form.maquina || !form.tipo) {
    throw new Error('Preencha data, máquina e tipo.')
  }
  return {
    data,
    maquina: form.maquina as Maquina,
    tipo: form.tipo as TipoParada,
    turno: strTrim(form.turno) || null,
    horaInicio: strTrim(form.horaInicio) || null,
    horaFim: strTrim(form.horaFim) || null,
    responsavelId: strTrim(form.responsavelId) || null,
    conjunto: strTrim(form.conjunto) || null,
    equipamento: strTrim(form.equipamento) || null,
    peca: strTrim(form.peca) || null,
    descricao: strTrim(form.descricao) || null,
    resolvido: form.resolvido,
  }
}

function applyOperadorManutencaoDefaults() {
  const p = permissionsStore.permissions
  if (!p || !isCargoOperadorOuManutencao(p.cargo)) {
    return
  }
  form.responsavelId = p.id
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
  form.responsavelId = ''
  form.turno = ''
  form.tipo = ''
  form.horaInicio = ''
  form.horaFim = ''
  form.resolvido = false
  form.conjunto = ''
  form.equipamento = ''
  form.peca = ''
  form.descricao = ''
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
  if (action !== 'novo-parada' && action !== 'edit-parada') {
    return
  }
  if (action === 'novo-parada') {
    resetForm()
    const d = strTrim(route.query.mapaData)
    const mq = route.query.mapaMaq
    if (d) {
      form.data = d
    }
    if (typeof mq === 'string' && isMaquina(mq)) {
      form.maquina = mq
    }
    if (shouldAutofillOperadorOuManutencao.value) {
      applyOperadorManutencaoDefaults()
    }
    dialogOpen.value = true
    clearMapaQuery()
    return
  }
  if (action === 'edit-parada' && route.query.mapaId) {
    const id = String(route.query.mapaId)
    try {
      const row = await fetchParadaById(id)
      openEdit(row)
    } catch {
      /* ignorar */
    }
    clearMapaQuery()
  }
}

function openCreate() {
  resetForm()
  if (shouldAutofillOperadorOuManutencao.value) {
    applyOperadorManutencaoDefaults()
  }
  dialogOpen.value = true
}

function openEdit(row: ParadaRow) {
  editingId.value = row.id
  form.data = row.data
  form.maquina = row.maquina
  form.responsavelId = row.responsavelId ?? ''
  form.turno = row.turno ?? ''
  form.tipo = row.tipo
  form.horaInicio = row.horaInicio ?? ''
  form.horaFim = row.horaFim ?? ''
  form.resolvido = row.resolvido
  form.conjunto = row.conjunto ?? ''
  form.equipamento = row.equipamento ?? ''
  form.peca = row.peca ?? ''
  form.descricao = row.descricao ?? ''
  formError.value = null
  dialogOpen.value = true
}

function buildApiQuery(): ParadasQuery {
  const q: ParadasQuery = {}
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
  const maq = strTrim(filters.maquina)
  if (maq) {
    q.maquina = maq
  }
  const tipo = strTrim(filters.tipo)
  if (tipo) {
    q.tipo = tipo
  }
  const turno = strTrim(filters.turno)
  if (turno) {
    q.turno = turno
  }
  const resp = strTrim(filters.responsavel)
  if (resp) {
    q.responsavel = resp
  }
  if (filters.resolvido === 'true' || filters.resolvido === 'false') {
    q.resolvido = filters.resolvido
  }
  return q
}

async function loadList() {
  listError.value = null
  loading.value = true
  try {
    rows.value = await fetchParadas(buildApiQuery())
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
  filters.maquina = ''
  filters.tipo = ''
  filters.turno = ''
  filters.responsavel = ''
  filters.resolvido = ''
}

async function loadEquipe() {
  catalogsError.value = null
  try {
    equipe.value = await fetchEquipeManutencao()
  } catch (e) {
    catalogsError.value =
      e instanceof Error ? e.message : 'Erro ao carregar equipe.'
  }
}

async function onSave() {
  formError.value = null
  saving.value = true
  try {
    const payload = toPayload()
    if (editingId.value) {
      await updateParada(editingId.value, payload)
    } else {
      await createParada(payload)
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
  if (!confirm('Excluir esta parada? Esta ação não pode ser desfeita.')) {
    return
  }
  formError.value = null
  deleting.value = true
  try {
    await deleteParada(id)
    dialogOpen.value = false
    await loadList()
  } catch (e) {
    formError.value =
      e instanceof Error ? e.message : 'Não foi possível excluir.'
  } finally {
    deleting.value = false
  }
}

const tipoOptions = Object.values(TIPO_PARADA)

onMounted(async () => {
  await loadEquipe()
  await processMapaQuery()
  loadList()
})

watch(
  () => route.query.mapaAction,
  async (a) => {
    if (a === 'novo-parada' || a === 'edit-parada') {
      await processMapaQuery()
    }
  },
)
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 bg-background p-4 md:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-lg font-semibold tracking-tight text-foreground">
        Paradas
      </h1>
      <Button v-if="canNovaParada" type="button" @click="openCreate">
        Nova parada
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
          <Label for="pf-data">Data (dia)</Label>
          <Input
            id="pf-data"
            v-model="filters.data"
            type="date"
            class="bg-background/50"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="pf-ini">Data início</Label>
          <Input
            id="pf-ini"
            v-model="filters.dataInicio"
            type="date"
            class="bg-background/50"
            :disabled="!!filters.data"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="pf-fim">Data fim</Label>
          <Input
            id="pf-fim"
            v-model="filters.dataFim"
            type="date"
            class="bg-background/50"
            :disabled="!!filters.data"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="pf-maq">Máquina</Label>
          <NativeSelect id="pf-maq" v-model="filters.maquina" class="w-full">
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
          <Label for="pf-tipo">Tipo</Label>
          <NativeSelect id="pf-tipo" v-model="filters.tipo" class="w-full">
            <NativeSelectOption value="">Todos</NativeSelectOption>
            <NativeSelectOption v-for="t in tipoOptions" :key="t" :value="t">
              {{ t }}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <div class="space-y-1.5">
          <Label for="pf-turno">Turno</Label>
          <Input
            id="pf-turno"
            v-model="filters.turno"
            class="bg-background/50"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="pf-resp">Responsável</Label>
          <NativeSelect id="pf-resp" v-model="filters.responsavel" class="w-full">
            <NativeSelectOption value="">Todos</NativeSelectOption>
            <NativeSelectOption
              v-for="m in equipe"
              :key="m.id"
              :value="m.id"
            >
              {{ m.nome || m.id }}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <div class="space-y-1.5">
          <Label for="pf-resolv">Resolvido</Label>
          <NativeSelect id="pf-resolv" v-model="filters.resolvido" class="w-full">
            <NativeSelectOption value="">Todos</NativeSelectOption>
            <NativeSelectOption value="true">Sim</NativeSelectOption>
            <NativeSelectOption value="false">Não</NativeSelectOption>
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
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead>Data</TableHead>
            <TableHead>Máquina</TableHead>
            <TableHead>Turno</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>H. início</TableHead>
            <TableHead>H. fim</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Conjunto</TableHead>
            <TableHead>Equip.</TableHead>
            <TableHead>Resolvido</TableHead>
            <TableHead class="max-w-[200px]">Descrição</TableHead>
            <TableHead v-if="canEdit" class="w-[100px] text-right">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="canEdit ? 12 : 11" class="text-center">
              Carregando…
            </TableCell>
          </TableRow>
          <TableRow v-else-if="!rows.length">
            <TableCell :colspan="canEdit ? 12 : 11" class="text-center">
              Nenhuma parada encontrada.
            </TableCell>
          </TableRow>
          <TableRow v-for="row in rows" :key="row.id">
            <TableCell>{{ row.data }}</TableCell>
            <TableCell>{{ row.maquina }}</TableCell>
            <TableCell>{{ row.turno ?? '—' }}</TableCell>
            <TableCell>{{ row.tipo }}</TableCell>
            <TableCell>{{ row.horaInicio ?? '—' }}</TableCell>
            <TableCell>{{ row.horaFim ?? '—' }}</TableCell>
            <TableCell>{{ row.responsavel?.nome ?? '—' }}</TableCell>
            <TableCell>{{ row.conjunto ?? '—' }}</TableCell>
            <TableCell>{{ row.equipamento ?? '—' }}</TableCell>
            <TableCell>{{ row.resolvido ? 'Sim' : 'Não' }}</TableCell>
            <TableCell
              class="max-w-[200px] truncate text-muted-foreground text-xs"
              :title="row.descricao ?? ''"
            >
              {{ row.descricao ?? '—' }}
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
            {{ editingId ? 'Editar parada' : 'Nova parada' }}
          </DialogTitle>
          <DialogDescription>
            Campos obrigatórios: data, máquina e tipo.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-6">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="paf-data">Data</Label>
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
                id="paf-data"
                v-model="form.data"
                type="date"
                required
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="paf-maq">Máquina</Label>
              <NativeSelect id="paf-maq" v-model="form.maquina" class="w-full">
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
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="paf-resp">Responsável (equipe manutenção)</Label>
              <NativeSelect
                id="paf-resp"
                v-model="form.responsavelId"
                class="w-full"
              >
                <NativeSelectOption value="">—</NativeSelectOption>
                <NativeSelectOption
                  v-for="m in equipe"
                  :key="m.id"
                  :value="m.id"
                >
                  {{ m.nome || m.id }}
                </NativeSelectOption>
              </NativeSelect>
              <p
                v-if="
                  shouldAutofillOperadorOuManutencao &&
                  !editingId &&
                  permissionsStore.permissions?.nome
                "
                class="text-xs text-muted-foreground"
              >
                {{ permissionsStore.permissions.nome }}
              </p>
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="paf-turno">Turno</Label>
              <Input
                id="paf-turno"
                v-model="form.turno"
                class="bg-background/50"
              />
            </div>
          </div>

          <Separator />

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="paf-tipo">Tipo</Label>
              <NativeSelect id="paf-tipo" v-model="form.tipo" class="w-full">
                <NativeSelectOption value="" disabled>
                  Selecione…
                </NativeSelectOption>
                <NativeSelectOption v-for="t in tipoOptions" :key="t" :value="t">
                  {{ t }}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="paf-ti">Hora início</Label>
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
                id="paf-ti"
                v-model="form.horaInicio"
                type="time"
                step="1"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <Label for="paf-tf">Hora fim</Label>
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
                id="paf-tf"
                v-model="form.horaFim"
                type="time"
                step="1"
                class="bg-background/50"
              />
            </div>
            <div class="flex items-center gap-2 sm:col-span-2">
              <input
                id="paf-resolv"
                v-model="form.resolvido"
                type="checkbox"
                class="size-4 rounded border-input accent-primary"
              />
              <Label for="paf-resolv" class="font-normal">Resolvido</Label>
            </div>
          </div>

          <Separator />

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="paf-conj">Conjunto</Label>
              <Input
                id="paf-conj"
                v-model="form.conjunto"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="paf-eq">Equipamento</Label>
              <Input
                id="paf-eq"
                v-model="form.equipamento"
                class="bg-background/50"
              />
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="paf-peca">Peça</Label>
              <Input id="paf-peca" v-model="form.peca" class="bg-background/50" />
            </div>
            <div class="space-y-1.5 sm:col-span-2">
              <Label for="paf-desc">Descrição</Label>
              <textarea
                id="paf-desc"
                v-model="form.descricao"
                rows="3"
                class="border-input placeholder:text-muted-foreground flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
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
