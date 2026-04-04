<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { usePermissionsStore } from '@/stores/permissions'
import {
  createProducao,
  deleteProducao,
  fetchOperadores,
  fetchProducaoById,
  fetchProdutos,
  updateProducao,
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

const dialogOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const isCargoOperador = computed(() => {
  const p = permissionsStore.permissions
  if (!p) {
    return false
  }
  return strTrim(p.cargo).toLowerCase() === 'operador'
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

const canEdit = computed(() => canEditProducao(permissionsStore.permissions))
const canDelete = computed(() =>
  canDeleteProducao(permissionsStore.permissions),
)

const canSalvarModal = computed(() => {
  if (editingId.value) {
    return canEdit.value
  }
  return canEdit.value || isOperadorUsuario.value
})

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

function fillFromRow(row: ProductionRow) {
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
      const row = await fetchProducaoById(id)
      fillFromRow(row)
    } catch {
      formError.value = 'Não foi possível carregar a produção.'
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
      await updateProducao(editingId.value, payload)
    } else {
      await createProducao(payload)
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
      'Excluir esta produção? Esta ação não pode ser desfeita.',
    )
  ) {
    return
  }
  formError.value = null
  deleting.value = true
  try {
    await deleteProducao(id)
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
              <Label for="mpm-pf-data">Data</Label>
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
              id="mpm-pf-data"
              v-model="form.data"
              type="date"
              required
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-pf-maq">Máquina</Label>
            <NativeSelect id="mpm-pf-maq" v-model="form.maquina" class="w-full">
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
            <Label for="mpm-pf-op">Operador</Label>
            <NativeSelect id="mpm-pf-op" v-model="form.operadorId" class="w-full">
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
            <Label for="mpm-pf-turno">Turno</Label>
            <Input
              id="mpm-pf-turno"
              v-model="form.turno"
              class="bg-background/50"
            />
          </div>
        </div>

        <Separator />

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="mpm-pf-lote">Lote</Label>
            <Input id="mpm-pf-lote" v-model="form.lote" class="bg-background/50" />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="mpm-pf-prod">Produto</Label>
            <NativeSelect id="mpm-pf-prod" v-model="form.produtoId" class="w-full">
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
            <Label for="mpm-pf-res">Resistência</Label>
            <Input
              id="mpm-pf-res"
              v-model="form.resistencia"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-pf-pig">Pigmentação</Label>
            <Input
              id="mpm-pf-pig"
              v-model="form.pigmentacao"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-pf-hi">Horímetro início</Label>
            <Input
              id="mpm-pf-hi"
              v-model="form.horimetroInicio"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-pf-hf">Horímetro fim</Label>
            <Input
              id="mpm-pf-hf"
              v-model="form.horimetroFim"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <Label for="mpm-pf-ti">Hora início</Label>
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
              id="mpm-pf-ti"
              v-model="form.horaInicio"
              type="time"
              step="1"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <Label for="mpm-pf-tf">Hora fim</Label>
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
              id="mpm-pf-tf"
              v-model="form.horaFim"
              type="time"
              step="1"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5 sm:col-span-2 sm:max-w-xs">
            <Label for="mpm-pf-placas">Placas produzidas</Label>
            <Input
              id="mpm-pf-placas"
              v-model="form.placasProduzidas"
              type="number"
              min="0"
              class="bg-background/50"
            />
          </div>
        </div>

        <Separator />

        <div class="space-y-3">
          <p class="text-xs font-medium text-muted-foreground leading-snug">
            Traço
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="mpm-pf-cim">Cimento</Label>
              <Input id="mpm-pf-cim" v-model="form.cimento" class="bg-background/50" />
            </div>
            <div class="space-y-1.5">
              <Label for="mpm-pf-areia">Areia</Label>
              <Input id="mpm-pf-areia" v-model="form.areia" class="bg-background/50" />
            </div>
            <div class="space-y-1.5">
              <Label for="mpm-pf-bn">Brita Natasha</Label>
              <Input id="mpm-pf-bn" v-model="form.britaNatasha" class="bg-background/50" />
            </div>
            <div class="space-y-1.5">
              <Label for="mpm-pf-bb">Brita Basalto</Label>
              <Input id="mpm-pf-bb" v-model="form.britaBasalto" class="bg-background/50" />
            </div>
            <div class="space-y-1.5">
              <Label for="mpm-pf-pn">Pó Natasha</Label>
              <Input id="mpm-pf-pn" v-model="form.poNatasha" class="bg-background/50" />
            </div>
            <div class="space-y-1.5">
              <Label for="mpm-pf-pb">Pó Basalto</Label>
              <Input id="mpm-pf-pb" v-model="form.poBasalto" class="bg-background/50" />
            </div>
            <div class="space-y-1.5">
              <Label for="mpm-pf-ad">Aditivo</Label>
              <Input id="mpm-pf-ad" v-model="form.aditivo" class="bg-background/50" />
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
