<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { usePermissionsStore } from '@/stores/permissions'
import {
  createHoraHora,
  deleteHoraHora,
  fetchHoraHoraById,
  updateHoraHora,
} from '@/lib/hora-hora-api'
import { fetchOperadores } from '@/lib/production-api'
import type { OperadorListItem } from '@/types/operador'
import type { HoraHoraPayload } from '@/types/hora-hora'
import {
  horaFimIntervalo,
  labelIntervaloHora,
} from '@/types/hora-hora'
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
const catalogsLoaded = ref(false)

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
  if (!p || !shouldAutofillOperadorCampos.value) {
    return
  }
  if (p.maquina) {
    form.maquina = p.maquina
  }
}

async function ensureCatalogs() {
  if (catalogsLoaded.value) {
    return
  }
  try {
    operadores.value = await fetchOperadores()
    catalogsLoaded.value = true
  } catch {
    formError.value = 'Erro ao carregar operadores.'
  }
}

async function prepareOpen() {
  formError.value = null
  await ensureCatalogs()
  const id = props.editId
  if (id) {
    try {
      const full = await fetchHoraHoraById(id)
      editingId.value = full.id
      form.data = full.data
      form.maquina = full.maquina
      const h = full.hora.trim()
      form.hora = /^\d{2}:\d{2}:\d{2}$/.test(h) ? h.slice(0, 5) : h
      form.placasProduzidas =
        full.placasProduzidas != null ? String(full.placasProduzidas) : ''
      form.meta = full.meta != null ? String(full.meta) : ''
      form.comentario = full.comentario ?? ''
    } catch {
      formError.value = 'Não foi possível carregar o registro.'
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
  () =>
    [props.modelValue, props.editId, props.presetData, props.presetMaquina] as const,
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
      await updateHoraHora(editingId.value, payload)
    } else {
      await createHoraHora(payload)
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
      'Excluir este registro hora a hora? Esta ação não pode ser desfeita.',
    )
  ) {
    return
  }
  formError.value = null
  deleting.value = true
  try {
    await deleteHoraHora(id)
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
          <Label for="mhh-data">Data</Label>
          <Input
            id="mhh-data"
            v-model="form.data"
            type="date"
            required
            class="bg-background/50"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="mhh-maq">Máquina</Label>
          <NativeSelect id="mhh-maq" v-model="form.maquina" class="w-full">
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
            <Label for="mhh-hi">Hora inicial</Label>
            <Input
              id="mhh-hi"
              v-model="form.hora"
              type="time"
              step="3600"
              required
              class="bg-background/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="mhh-hf">Hora final (automático)</Label>
            <input
              id="mhh-hf"
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
          <Label for="mhh-pl">Placas produzidas</Label>
          <Input
            id="mhh-pl"
            v-model="form.placasProduzidas"
            inputmode="numeric"
            class="bg-background/50"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="mhh-meta">Meta (intervalo)</Label>
          <Input
            id="mhh-meta"
            v-model="form.meta"
            inputmode="numeric"
            class="bg-background/50"
          />
        </div>
        <div class="space-y-1.5">
          <Label for="mhh-com">Comentário</Label>
          <Input id="mhh-com" v-model="form.comentario" class="bg-background/50" />
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
