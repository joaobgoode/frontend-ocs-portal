<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { usePermissionsStore } from '@/stores/permissions'
import {
  createParada,
  deleteParada,
  fetchEquipeManutencao,
  fetchParadaById,
  updateParada,
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

const equipe = ref<EquipeManutencaoItem[]>([])
const catalogsLoaded = ref(false)

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

const dialogOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const isNaEquipe = computed(() => {
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
  if (isNaEquipe.value) {
    return true
  }
  const c = slugCargo(p.cargo)
  return c === 'operador' || c === 'manutencao'
})

const canEdit = computed(() => canEditParadas(permissionsStore.permissions))
const canDelete = computed(() =>
  canDeleteParadas(permissionsStore.permissions),
)

const canNovaParada = computed(
  () => canEdit.value || isEquipeManutencaoUsuario.value,
)

const canSalvarModal = computed(() => {
  if (editingId.value) {
    return canEdit.value
  }
  return canNovaParada.value
})

const shouldAutofillOperadorOuManutencao = computed(() =>
  isCargoOperadorOuManutencao(permissionsStore.permissions?.cargo),
)

const tipoOptions = Object.values(TIPO_PARADA)

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

function fillFromRow(row: ParadaRow) {
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
}

async function ensureCatalogs() {
  if (catalogsLoaded.value) {
    return
  }
  try {
    equipe.value = await fetchEquipeManutencao()
    catalogsLoaded.value = true
  } catch {
    formError.value = 'Erro ao carregar equipe de manutenção.'
  }
}

async function prepareOpen() {
  formError.value = null
  await ensureCatalogs()
  const id = props.editId
  if (id) {
    try {
      const row = await fetchParadaById(id)
      fillFromRow(row)
    } catch {
      formError.value = 'Não foi possível carregar a parada.'
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
    if (shouldAutofillOperadorOuManutencao.value) {
      applyOperadorManutencaoDefaults()
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
      await updateParada(editingId.value, payload)
    } else {
      await createParada(payload)
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
  if (!confirm('Excluir esta parada? Esta ação não pode ser desfeita.')) {
    return
  }
  formError.value = null
  deleting.value = true
  try {
    await deleteParada(id)
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
              <Label for="mpm-pa-data">Data</Label>
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
              id="mpm-pa-data"
              v-model="form.data"
              type="date"
              required
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-pa-maq">Máquina</Label>
            <NativeSelect id="mpm-pa-maq" v-model="form.maquina" class="w-full">
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
            <Label for="mpm-pa-resp">Responsável (equipe manutenção)</Label>
            <NativeSelect
              id="mpm-pa-resp"
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
            <Label for="mpm-pa-turno">Turno</Label>
            <Input
              id="mpm-pa-turno"
              v-model="form.turno"
              class="bg-background/50"
            />
          </div>
        </div>

        <Separator />

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="mpm-pa-tipo">Tipo</Label>
            <NativeSelect id="mpm-pa-tipo" v-model="form.tipo" class="w-full">
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
              <Label for="mpm-pa-ti">Hora início</Label>
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
              id="mpm-pa-ti"
              v-model="form.horaInicio"
              type="time"
              step="1"
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <Label for="mpm-pa-tf">Hora fim</Label>
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
              id="mpm-pa-tf"
              v-model="form.horaFim"
              type="time"
              step="1"
              class="bg-background/50"
            />
          </div>
          <div class="flex items-center gap-2 sm:col-span-2">
            <input
              id="mpm-pa-resolv"
              v-model="form.resolvido"
              type="checkbox"
              class="size-4 rounded border-input accent-primary"
            />
            <Label for="mpm-pa-resolv" class="font-normal">Resolvido</Label>
          </div>
        </div>

        <Separator />

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="mpm-pa-conj">Conjunto</Label>
            <Input id="mpm-pa-conj" v-model="form.conjunto" class="bg-background/50" />
          </div>
          <div class="space-y-1.5">
            <Label for="mpm-pa-eq">Equipamento</Label>
            <Input id="mpm-pa-eq" v-model="form.equipamento" class="bg-background/50" />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="mpm-pa-peca">Peça</Label>
            <Input id="mpm-pa-peca" v-model="form.peca" class="bg-background/50" />
          </div>
          <div class="space-y-1.5 sm:col-span-2">
            <Label for="mpm-pa-desc">Descrição</Label>
            <textarea
              id="mpm-pa-desc"
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
</template>
