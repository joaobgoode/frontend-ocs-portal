<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { usePermissionsStore } from '@/stores/permissions'
import {
  createEstufa,
  deleteEstufa,
  fetchEstufaById,
  updateEstufa,
} from '@/lib/estufas-api'
import { fetchOperadores, fetchProdutos } from '@/lib/production-api'
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

const props = defineProps<{
  modelValue: boolean
  presetData: string
  presetMaquina: Maquina
  editId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const permissionsStore = usePermissionsStore()

const operadores = ref<OperadorListItem[]>([])
const produtos = ref<{ id: string; nome: string }[]>([])
const catalogsLoaded = ref(false)

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

const dialogOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

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

const canEdit = computed(() => canEditEstufa(permissionsStore.permissions))
const canDelete = computed(() =>
  canDeleteEstufa(permissionsStore.permissions),
)

const canNovaEstufa = computed(
  () => canEdit.value || isOperadorEstufaUsuario.value,
)

const canSalvarModal = computed(() => {
  if (editingId.value) {
    return canEdit.value
  }
  return canNovaEstufa.value
})

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

function fillFromRow(row: EstufaRow) {
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
}

async function ensureCatalogs() {
  if (catalogsLoaded.value) {
    return
  }
  try {
    const [p, o] = await Promise.all([fetchProdutos(), fetchOperadores()])
    produtos.value = p
    operadores.value = o
    catalogsLoaded.value = true
  } catch {
    formError.value = 'Erro ao carregar produtos ou operadores.'
  }
}

async function prepareOpen() {
  formError.value = null
  await ensureCatalogs()
  const id = props.editId
  if (id) {
    try {
      const row = await fetchEstufaById(id)
      fillFromRow(row)
    } catch {
      formError.value = 'Não foi possível carregar a estufa.'
      resetForm()
    }
  } else {
    resetForm()
    const d = strTrim(props.presetData)
    if (d) {
      form.data = d
    }
    if (isMaquina(props.presetMaquina)) {
      form.maquina = props.presetMaquina
    }
    if (shouldAutofillOperadorCampos.value) {
      applyOperadorDefaults()
    }
  }
}

watch(
  () => [props.modelValue, props.editId, props.presetData, props.presetMaquina] as const,
  async ([open]) => {
    if (open) {
      await prepareOpen()
    } else {
      resetForm()
    }
  },
)

async function onSave() {
  if (!canSalvarModal.value) {
    return
  }
  formError.value = null
  saving.value = true
  try {
    const payload = toPayload()
    if (editingId.value) {
      await updateEstufa(editingId.value, payload)
    } else {
      await createEstufa(payload)
    }
    emit('update:modelValue', false)
    emit('saved')
    resetForm()
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
      'Excluir este registro de estufa? Esta ação não pode ser desfeita.',
    )
  ) {
    return
  }
  formError.value = null
  deleting.value = true
  try {
    await deleteEstufa(id)
    emit('update:modelValue', false)
    emit('saved')
    resetForm()
  } catch (e) {
    formError.value =
      e instanceof Error ? e.message : 'Não foi possível excluir.'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
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
              <Label for="mpm-es-data">Data</Label>
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
              id="mpm-es-data"
              v-model="form.data"
              type="date"
              required
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-es-maq">Máquina</Label>
            <NativeSelect id="mpm-es-maq" v-model="form.maquina" class="w-full">
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
            <Label for="mpm-es-prod">Produto</Label>
            <NativeSelect id="mpm-es-prod" v-model="form.produtoId" class="w-full">
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
            <Label for="mpm-es-res">Resistência</Label>
            <Input
              id="mpm-es-res"
              v-model="form.resistencia"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-es-op">Operador</Label>
            <NativeSelect id="mpm-es-op" v-model="form.operadorId" class="w-full">
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
            <Label for="mpm-es-turno">Turno</Label>
            <Input id="mpm-es-turno" v-model="form.turno" class="bg-background/50" />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="mpm-es-num">Número</Label>
            <Input id="mpm-es-num" v-model="form.numero" class="bg-background/50" />
          </div>
        </div>

        <Separator />

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="mpm-es-placas">Placas</Label>
            <Input
              id="mpm-es-placas"
              v-model="form.placas"
              inputmode="numeric"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-es-pec">Peças produzidas</Label>
            <Input
              id="mpm-es-pec"
              v-model="form.pecasProduzidas"
              inputmode="numeric"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <Label for="mpm-es-hlib">Hora liberação</Label>
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
              id="mpm-es-hlib"
              v-model="form.horaLiberacao"
              type="time"
              step="1"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-es-lote">Lote</Label>
            <Input id="mpm-es-lote" v-model="form.lote" class="bg-background/50" />
          </div>
        </div>

        <Separator />

        <p class="text-sm font-medium text-foreground">Paletização</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="mpm-es-dpal">Data paletização</Label>
            <Input
              id="mpm-es-dpal"
              v-model="form.dataPaletizacao"
              type="date"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-es-tpal">Turno paletização</Label>
            <Input
              id="mpm-es-tpal"
              v-model="form.turnoPaletizacao"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <Label for="mpm-es-hpal">Hora paletização</Label>
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
              id="mpm-es-hpal"
              v-model="form.horaPaletizacao"
              type="time"
              step="1"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-es-ppal">Peças paletizadas</Label>
            <Input
              id="mpm-es-ppal"
              v-model="form.pecasPaletizadas"
              inputmode="numeric"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-es-pal">Paletes usados</Label>
            <Input
              id="mpm-es-pal"
              v-model="form.paletesUsados"
              inputmode="numeric"
              class="bg-background/50"
            />
          </div>
        </div>

        <Separator />

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="mpm-es-nc">Não conforme</Label>
            <Input
              id="mpm-es-nc"
              v-model="form.naoConforme"
              inputmode="numeric"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-es-suc">Sucata</Label>
            <Input
              id="mpm-es-suc"
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
</template>
