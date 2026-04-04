<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  AlertTriangle,
  Clock,
  Factory,
  Flame,
  LayoutDashboard,
  Package,
  Pencil,
  Plus,
} from 'lucide-vue-next'
import {
  fetchEquipeManutencao,
  fetchParadas,
} from '@/lib/paradas-api'
import { fetchEstufas } from '@/lib/estufas-api'
import { fetchHoraHoras } from '@/lib/hora-hora-api'
import { fetchOperadores, fetchProducoes } from '@/lib/production-api'
import { usePermissionsStore } from '@/stores/permissions'
import type { EquipeManutencaoItem } from '@/types/equipe-manutencao'
import type { OperadorListItem } from '@/types/operador'
import type { EstufaRow } from '@/types/estufa'
import type { ParadaRow, TipoParada } from '@/types/parada'
import { TIPO_PARADA } from '@/types/parada'
import type { ProductionRow } from '@/types/production'
import type { HoraHoraRow } from '@/types/hora-hora'
import { compareHoraHoraRows, labelIntervaloHora } from '@/types/hora-hora'
import type { Maquina } from '@/types/user-permission'
import {
  MAQUINA,
  PRODUCAO_PERMISSAO,
  canEditEstufa,
  canEditParadas,
  canEditProducao,
  isCargoOperador,
  slugCargo,
} from '@/types/user-permission'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import MapaEstufaModal from '@/components/mapa/MapaEstufaModal.vue'
import MapaHoraHoraModal from '@/components/mapa/MapaHoraHoraModal.vue'
import MapaParadaModal from '@/components/mapa/MapaParadaModal.vue'
import MapaProducaoModal from '@/components/mapa/MapaProducaoModal.vue'

function todayLocalISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const permissionsStore = usePermissionsStore()

const producaoModalOpen = ref(false)
const producaoEditId = ref<string | null>(null)
const paradaModalOpen = ref(false)
const paradaEditId = ref<string | null>(null)
const estufaModalOpen = ref(false)
const estufaEditId = ref<string | null>(null)
const horaHoraModalOpen = ref(false)
const horaHoraEditId = ref<string | null>(null)

const selectedMaquina = ref<Maquina>(MAQUINA.VP300)
const selectedDate = ref(todayLocalISODate())

const operadores = ref<OperadorListItem[]>([])
const equipe = ref<EquipeManutencaoItem[]>([])

const producoes = ref<ProductionRow[]>([])
const estufas = ref<EstufaRow[]>([])
const paradas = ref<ParadaRow[]>([])
const horaHoras = ref<HoraHoraRow[]>([])

const loading = ref(false)
const error = ref<string | null>(null)

function strTrim(v: unknown): string {
  if (v == null) {
    return ''
  }
  return String(v).trim()
}

async function loadDashboard() {
  const data = strTrim(selectedDate.value)
  const maq = selectedMaquina.value
  if (!data) {
    return
  }
  loading.value = true
  error.value = null
  try {
    const [p, eList, par, hh] = await Promise.all([
      fetchProducoes({ data, maquina: maq }),
      fetchEstufas({ data, maquina: maq }),
      fetchParadas({ data, maquina: maq }),
      fetchHoraHoras({ data, maquina: maq }),
    ])
    producoes.value = p
    estufas.value = eList.filter((r) => r.maquina === maq)
    paradas.value = par
    horaHoras.value = hh.filter((r) => r.maquina === maq)
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Não foi possível carregar o mapa.'
    producoes.value = []
    estufas.value = []
    paradas.value = []
    horaHoras.value = []
  } finally {
    loading.value = false
  }
}

const totalProducoes = computed(() => producoes.value.length)
const somaPlacasProducao = computed(() =>
  producoes.value.reduce((acc, r) => acc + (r.placasProduzidas ?? 0), 0),
)

const totalEstufas = computed(() => estufas.value.length)
const somaPecasEstufaProd = computed(() =>
  estufas.value.reduce((acc, r) => acc + (r.pecasProduzidas ?? 0), 0),
)
const somaPecasEstufaPal = computed(() =>
  estufas.value.reduce((acc, r) => acc + (r.pecasPaletizadas ?? 0), 0),
)

const totalParadas = computed(() => paradas.value.length)
const paradasAbertas = computed(() =>
  paradas.value.filter((p) => !p.resolvido).length,
)

const sortedHoraHoras = computed(() =>
  [...horaHoras.value].sort(compareHoraHoraRows),
)

const horaHorasComAcumulado = computed(() => {
  let acumP = 0
  let acumM = 0
  return sortedHoraHoras.value.map((r) => {
    const placasN = r.placasProduzidas ?? 0
    const metaN = r.meta ?? 0
    acumP += placasN
    acumM += metaN
    return {
      ...r,
      diffHora: placasN - metaN,
      acumPlacas: acumP,
      acumMeta: acumM,
      diffAcum: acumP - acumM,
    }
  })
})

const totalHoraHora = computed(() => horaHoras.value.length)
const somaPlacasHoraHora = computed(() =>
  horaHoras.value.reduce((acc, r) => acc + (r.placasProduzidas ?? 0), 0),
)
const somaMetaHoraHora = computed(() =>
  horaHoras.value.reduce((acc, r) => acc + (r.meta ?? 0), 0),
)
const diffHoraHoraTotal = computed(
  () => somaPlacasHoraHora.value - somaMetaHoraHora.value,
)

function fmtSignedMapa(n: number): string {
  if (n > 0) {
    return `+${n}`
  }
  return String(n)
}

const temAlgumDado = computed(
  () =>
    totalProducoes.value > 0 ||
    totalEstufas.value > 0 ||
    totalParadas.value > 0 ||
    totalHoraHora.value > 0,
)

const isCargoOperadorMapa = computed(() =>
  isCargoOperador(permissionsStore.permissions?.cargo),
)

const isOperadorUsuarioMapa = computed(() => {
  const p = permissionsStore.permissions
  if (!p) {
    return false
  }
  if (isCargoOperadorMapa.value) {
    return true
  }
  if (p.permissaoProducao === PRODUCAO_PERMISSAO.VISUALIZADOR) {
    return true
  }
  return operadores.value.some((o) => o.id === p.id)
})

const canEditProducaoMapa = computed(() =>
  canEditProducao(permissionsStore.permissions),
)
const canNovaProducaoMapa = computed(
  () => canEditProducaoMapa.value || isOperadorUsuarioMapa.value,
)

const isNaEquipeMapa = computed(() => {
  const p = permissionsStore.permissions
  if (!p) {
    return false
  }
  return equipe.value.some((m) => m.id === p.id)
})

const isEquipeManutencaoUsuarioMapa = computed(() => {
  const p = permissionsStore.permissions
  if (!p) {
    return false
  }
  if (isNaEquipeMapa.value) {
    return true
  }
  const c = slugCargo(p.cargo)
  return c === 'operador' || c === 'manutencao'
})

const canEditParadasMapa = computed(() =>
  canEditParadas(permissionsStore.permissions),
)
const canNovaParadaMapa = computed(
  () => canEditParadasMapa.value || isEquipeManutencaoUsuarioMapa.value,
)

const canEditEstufaMapa = computed(() =>
  canEditEstufa(permissionsStore.permissions),
)

const isOperadorEstufaUsuarioMapa = computed(() => {
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

const canNovaEstufaMapa = computed(
  () => canEditEstufaMapa.value || isOperadorEstufaUsuarioMapa.value,
)

const canNovaHoraHoraMapa = computed(
  () => canEditProducaoMapa.value || isOperadorUsuarioMapa.value,
)

function openNovaProducao() {
  producaoEditId.value = null
  producaoModalOpen.value = true
}

function openEditProducao(row: ProductionRow) {
  producaoEditId.value = row.id
  producaoModalOpen.value = true
}

function openNovaParada() {
  paradaEditId.value = null
  paradaModalOpen.value = true
}

function openEditParada(row: ParadaRow) {
  paradaEditId.value = row.id
  paradaModalOpen.value = true
}

function openNovaEstufa() {
  estufaEditId.value = null
  estufaModalOpen.value = true
}

function openEditEstufa(row: EstufaRow) {
  estufaEditId.value = row.id
  estufaModalOpen.value = true
}

function openNovaHoraHora() {
  horaHoraEditId.value = null
  horaHoraModalOpen.value = true
}

function openEditHoraHora(row: HoraHoraRow) {
  horaHoraEditId.value = row.id
  horaHoraModalOpen.value = true
}

onMounted(() => {
  void Promise.all([
    fetchOperadores()
      .then((r) => {
        operadores.value = r
      })
      .catch(() => {
        operadores.value = []
      }),
    fetchEquipeManutencao()
      .then((r) => {
        equipe.value = r
      })
      .catch(() => {
        equipe.value = []
      }),
  ])
})

function paradaBorderClass(tipo: TipoParada): string {
  switch (tipo) {
    case TIPO_PARADA.MECANICA:
      return 'border-l-amber-500'
    case TIPO_PARADA.ELETRICA:
      return 'border-l-yellow-400'
    case TIPO_PARADA.EXTERNA:
      return 'border-l-sky-500'
    case TIPO_PARADA.PREVENTIVA:
      return 'border-l-emerald-500'
    default:
      return 'border-l-muted-foreground/40'
  }
}

/** Fundo do bloco “Problema”, alinhado às cores do tipo. */
function paradaProblemaBoxClass(tipo: TipoParada): string {
  switch (tipo) {
    case TIPO_PARADA.MECANICA:
      return 'border-amber-500/25 bg-amber-500/10'
    case TIPO_PARADA.ELETRICA:
      return 'border-yellow-400/30 bg-yellow-400/10'
    case TIPO_PARADA.EXTERNA:
      return 'border-sky-500/25 bg-sky-500/10'
    case TIPO_PARADA.PREVENTIVA:
      return 'border-emerald-500/25 bg-emerald-500/10'
    default:
      return 'border-muted-foreground/20 bg-muted/40'
  }
}

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
    return `${days}d ${h}h`
  }
  if (h > 0) {
    return `${h}h ${m}min`
  }
  if (m > 0) {
    return `${m}min`
  }
  return '<1 min'
}

function fmtHoraCurta(v: string | null | undefined): string {
  const s = strTrim(v)
  if (!s) {
    return '—'
  }
  const m = /^(\d{1,2}:\d{2})/.exec(s)
  return m?.[1] ?? s
}

watch(
  [selectedMaquina, selectedDate],
  () => {
    void loadDashboard()
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-1 flex-col gap-6 bg-background p-4 md:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-center gap-2">
        <div
          class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <LayoutDashboard class="size-5" />
        </div>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-foreground">
            Mapa da produção
          </h1>
          <p class="text-sm text-muted-foreground">
            Visão do dia por máquina: produções, estufas, paradas e hora a hora.
          </p>
        </div>
      </div>
    </div>

    <Card class="border-border/80 shadow-sm">
      <CardHeader class="pb-3">
        <CardTitle class="text-base">Filtros</CardTitle>
        <CardDescription>
          Escolha a máquina e o dia para montar o painel.
        </CardDescription>
      </CardHeader>
      <CardContent
        class="flex flex-wrap items-end gap-4 border-t border-border/60 pt-4"
      >
        <div class="space-y-1.5">
          <Label for="mapa-maq">Máquina</Label>
          <NativeSelect
            id="mapa-maq"
            v-model="selectedMaquina"
            class="w-[min(100%,12rem)] min-w-[10rem]"
          >
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
          <Label for="mapa-data">Dia</Label>
          <Input
            id="mapa-data"
            v-model="selectedDate"
            type="date"
            class="w-[min(100%,12rem)] bg-background/50"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          :disabled="loading || !selectedDate"
          @click="loadDashboard"
        >
          {{ loading ? 'Carregando…' : 'Atualizar' }}
        </Button>
        <div
          v-if="
            canNovaProducaoMapa ||
            canNovaParadaMapa ||
            canNovaEstufaMapa ||
            canNovaHoraHoraMapa
          "
          class="flex w-full flex-col gap-2 border-t border-border/60 pt-4 md:ml-auto md:w-auto md:border-t-0 md:border-l md:pl-4"
        >
          <p class="text-xs font-medium text-muted-foreground">
            Novo (usa o dia e a máquina acima)
          </p>
          <div class="flex flex-wrap gap-2">
            <Button
              v-if="canNovaProducaoMapa"
              type="button"
              variant="outline"
              size="sm"
              class="gap-1.5"
              :disabled="!selectedDate"
              @click="openNovaProducao"
            >
              <Plus class="size-3.5" />
              Produção
            </Button>
            <Button
              v-if="canNovaParadaMapa"
              type="button"
              variant="outline"
              size="sm"
              class="gap-1.5"
              :disabled="!selectedDate"
              @click="openNovaParada"
            >
              <Plus class="size-3.5" />
              Parada
            </Button>
            <Button
              v-if="canNovaEstufaMapa"
              type="button"
              variant="outline"
              size="sm"
              class="gap-1.5"
              :disabled="!selectedDate"
              @click="openNovaEstufa"
            >
              <Plus class="size-3.5" />
              Estufa
            </Button>
            <Button
              v-if="canNovaHoraHoraMapa"
              type="button"
              variant="outline"
              size="sm"
              class="gap-1.5"
              :disabled="!selectedDate"
              @click="openNovaHoraHora"
            >
              <Plus class="size-3.5" />
              Hora a hora
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <template v-else>
      <div
        v-if="!loading && selectedDate && !temAlgumDado"
        class="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground"
      >
        <p>
          Nada registrado para
          <span class="font-medium text-foreground">{{ selectedMaquina }}</span>
          em
          <span class="font-medium text-foreground">{{ selectedDate }}</span>
          .
        </p>
        <div
          v-if="
            canNovaProducaoMapa ||
            canNovaParadaMapa ||
            canNovaEstufaMapa ||
            canNovaHoraHoraMapa
          "
          class="flex flex-wrap justify-center gap-2"
        >
          <Button
            v-if="canNovaProducaoMapa"
            type="button"
            variant="secondary"
            size="sm"
            class="gap-1.5"
            @click="openNovaProducao"
          >
            <Plus class="size-3.5" />
            Nova produção
          </Button>
          <Button
            v-if="canNovaParadaMapa"
            type="button"
            variant="secondary"
            size="sm"
            class="gap-1.5"
            @click="openNovaParada"
          >
            <Plus class="size-3.5" />
            Nova parada
          </Button>
          <Button
            v-if="canNovaEstufaMapa"
            type="button"
            variant="secondary"
            size="sm"
            class="gap-1.5"
            @click="openNovaEstufa"
          >
            <Plus class="size-3.5" />
            Nova estufa
          </Button>
          <Button
            v-if="canNovaHoraHoraMapa"
            type="button"
            variant="secondary"
            size="sm"
            class="gap-1.5"
            @click="openNovaHoraHora"
          >
            <Plus class="size-3.5" />
            Hora a hora
          </Button>
        </div>
      </div>

      <div v-else class="flex flex-col gap-6">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          class="relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-sm"
        >
          <div
            class="absolute right-3 top-3 rounded-md bg-blue-500/15 p-2 text-blue-600 dark:text-blue-400"
          >
            <Factory class="size-5" />
          </div>
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Produções
          </p>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            {{ loading ? '…' : totalProducoes }}
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ loading ? '…' : `${somaPlacasProducao} placas` }}
          </p>
        </div>
        <div
          class="relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-sm"
        >
          <div
            class="absolute right-3 top-3 rounded-md bg-orange-500/15 p-2 text-orange-600 dark:text-orange-400"
          >
            <Flame class="size-5" />
          </div>
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estufas
          </p>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            {{ loading ? '…' : totalEstufas }}
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            <template v-if="!loading">
              {{ somaPecasEstufaProd }} peças prod. ·
              {{ somaPecasEstufaPal }} paletiz.
            </template>
            <template v-else>…</template>
          </p>
        </div>
        <div
          class="relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-sm"
        >
          <div
            class="absolute right-3 top-3 rounded-md bg-rose-500/15 p-2 text-rose-600 dark:text-rose-400"
          >
            <AlertTriangle class="size-5" />
          </div>
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Paradas
          </p>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            {{ loading ? '…' : totalParadas }}
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ loading ? '…' : `${paradasAbertas} em aberto` }}
          </p>
        </div>
        <div
          class="relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-sm"
        >
          <div
            class="absolute right-3 top-3 rounded-md bg-violet-500/15 p-2 text-violet-600 dark:text-violet-400"
          >
            <Clock class="size-5" />
          </div>
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hora a hora
          </p>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            {{ loading ? '…' : totalHoraHora }}
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            <template v-if="!loading">
              {{ somaPlacasHoraHora }} placas · meta {{ somaMetaHoraHora }}
              <span
                class="font-medium"
                :class="
                  diffHoraHoraTotal > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : diffHoraHoraTotal < 0
                      ? 'text-destructive'
                      : 'text-foreground'
                "
              >
                ({{ fmtSignedMapa(diffHoraHoraTotal) }})
              </span>
            </template>
            <template v-else>…</template>
          </p>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section class="flex flex-col gap-3">
          <div
            class="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-foreground"
          >
            <div class="flex items-center gap-2">
              <Factory class="size-4 text-blue-600 dark:text-blue-400" />
              Produções do dia
            </div>
            <Button
              v-if="canNovaProducaoMapa && !loading && selectedDate"
              type="button"
              variant="ghost"
              size="sm"
              class="h-8 gap-1 text-xs"
              @click="openNovaProducao"
            >
              <Plus class="size-3.5" />
              Novo
            </Button>
          </div>
          <div
            v-if="loading"
            class="rounded-lg border border-border/60 bg-muted/30 py-10 text-center text-sm text-muted-foreground"
          >
            Carregando…
          </div>
          <div
            v-else-if="!totalProducoes"
            class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 py-8 text-center text-sm text-muted-foreground"
          >
            <span>Nenhuma produção neste filtro.</span>
            <Button
              v-if="canNovaProducaoMapa && selectedDate"
              type="button"
              variant="secondary"
              size="sm"
              class="gap-1.5"
              @click="openNovaProducao"
            >
              <Plus class="size-3.5" />
              Nova produção
            </Button>
          </div>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="row in producoes"
              :key="row.id"
              class="relative flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-gradient-to-br from-card to-muted/20 px-4 py-3 pr-12 shadow-sm"
            >
              <Button
                v-if="canEditProducaoMapa"
                type="button"
                variant="ghost"
                size="icon"
                class="absolute right-1 top-1 size-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Editar produção"
                @click.stop="openEditProducao(row)"
              >
                <Pencil class="size-4" />
              </Button>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium text-foreground">
                  {{ row.produto?.nome ?? 'Produto' }}
                </p>
                <p class="text-xs text-muted-foreground">
                  Lote {{ row.lote ?? '—' }} · Turno {{ row.turno ?? '—' }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2 text-xs">
                <span
                  class="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary"
                >
                  {{ row.placasProduzidas ?? 0 }} placas
                </span>
                <span
                  v-if="row.resistencia"
                  class="rounded-full bg-muted px-2.5 py-1 text-muted-foreground"
                >
                  {{ row.resistencia }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section class="flex flex-col gap-3">
          <div
            class="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-foreground"
          >
            <div class="flex items-center gap-2">
              <AlertTriangle class="size-4 text-rose-600 dark:text-rose-400" />
              Paradas do dia
            </div>
            <Button
              v-if="canNovaParadaMapa && !loading && selectedDate"
              type="button"
              variant="ghost"
              size="sm"
              class="h-8 gap-1 text-xs"
              @click="openNovaParada"
            >
              <Plus class="size-3.5" />
              Novo
            </Button>
          </div>
          <div
            v-if="loading"
            class="rounded-lg border border-border/60 bg-muted/30 py-10 text-center text-sm text-muted-foreground"
          >
            Carregando…
          </div>
          <div
            v-else-if="!totalParadas"
            class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 py-8 text-center text-sm text-muted-foreground"
          >
            <span>Nenhuma parada neste filtro.</span>
            <Button
              v-if="canNovaParadaMapa && selectedDate"
              type="button"
              variant="secondary"
              size="sm"
              class="gap-1.5"
              @click="openNovaParada"
            >
              <Plus class="size-3.5" />
              Nova parada
            </Button>
          </div>
          <div v-else class="flex max-h-[min(28rem,50vh)] flex-col gap-2 overflow-y-auto pr-1">
            <div
              v-for="row in paradas"
              :key="row.id"
              class="border-l-4 border-y border-r border-border/70 bg-card py-3 pl-3 pr-3 shadow-sm"
              :class="paradaBorderClass(row.tipo)"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-medium capitalize text-foreground">
                  {{ row.tipo }}
                </span>
                <div class="flex items-center gap-1">
                  <Button
                    v-if="canEditParadasMapa"
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Editar parada"
                    @click.stop="openEditParada(row)"
                  >
                    <Pencil class="size-3.5" />
                  </Button>
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="
                      row.resolvido
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    "
                  >
                    {{ row.resolvido ? 'Resolvido' : 'Aberto' }}
                  </span>
                </div>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ fmtHoraCurta(row.horaInicio) }} →
                {{ fmtHoraCurta(row.horaFim) }}
                <span v-if="row.turno"> · {{ row.turno }}</span>
              </p>
              <div
                class="mt-2 rounded-md border px-2.5 py-2"
                :class="paradaProblemaBoxClass(row.tipo)"
              >
                <p
                  class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Problema
                </p>
                <p
                  class="mt-1 text-sm leading-snug text-foreground whitespace-pre-wrap break-words"
                >
                  {{ strTrim(row.descricao) || 'Sem descrição.' }}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="flex flex-col gap-3">
        <div
          class="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-foreground"
        >
          <div class="flex items-center gap-2">
            <Package class="size-4 text-orange-600 dark:text-orange-400" />
            Estufas do dia
          </div>
          <Button
            v-if="canNovaEstufaMapa && !loading && selectedDate"
            type="button"
            variant="ghost"
            size="sm"
            class="h-8 gap-1 text-xs"
            @click="openNovaEstufa"
          >
            <Plus class="size-3.5" />
            Novo
          </Button>
        </div>
        <div
          v-if="loading"
          class="rounded-lg border border-border/60 bg-muted/30 py-10 text-center text-sm text-muted-foreground"
        >
          Carregando…
        </div>
        <div
          v-else-if="!totalEstufas"
          class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 py-8 text-center text-sm text-muted-foreground"
        >
          <span>Nenhuma estufa neste filtro.</span>
          <Button
            v-if="canNovaEstufaMapa && selectedDate"
            type="button"
            variant="secondary"
            size="sm"
            class="gap-1.5"
            @click="openNovaEstufa"
          >
            <Plus class="size-3.5" />
            Nova estufa
          </Button>
        </div>
        <div
          v-else
          class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          <div
            v-for="row in estufas"
            :key="row.id"
            class="flex flex-col gap-3 rounded-xl border border-border/70 bg-gradient-to-b from-card to-muted/15 p-4 shadow-sm"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate font-medium text-foreground">
                  {{ row.produto?.nome ?? 'Produto' }}
                </p>
                <p class="text-xs text-muted-foreground">
                  Nº {{ row.numero ?? '—' }}
                  <span v-if="row.resistencia"> · {{ row.resistencia }}</span>
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <Button
                  v-if="canEditEstufaMapa"
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="Editar estufa"
                  @click.stop="openEditEstufa(row)"
                >
                  <Pencil class="size-3.5" />
                </Button>
                <span
                  class="rounded-md bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-700 dark:text-orange-400"
                >
                  {{ formatTempoEstufa(row) }}
                </span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-center text-xs">
              <div class="rounded-md bg-muted/50 py-2">
                <p class="text-muted-foreground">Liberação</p>
                <p class="font-semibold tabular-nums text-foreground">
                  {{ fmtHoraCurta(row.horaLiberacao) }}
                </p>
              </div>
              <div class="rounded-md bg-muted/50 py-2">
                <p class="text-muted-foreground">Paletiz.</p>
                <p class="font-semibold tabular-nums text-foreground">
                  {{ fmtHoraCurta(row.horaPaletizacao) }}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2 border-t border-border/50 pt-2 text-xs">
              <span class="rounded-full bg-background px-2 py-1 ring-1 ring-border">
                Prod. {{ row.pecasProduzidas ?? '—' }}
              </span>
              <span class="rounded-full bg-background px-2 py-1 ring-1 ring-border">
                Pal. {{ row.pecasPaletizadas ?? '—' }}
              </span>
              <span
                v-if="row.paletesUsados != null"
                class="rounded-full bg-background px-2 py-1 ring-1 ring-border"
              >
                Paletes {{ row.paletesUsados }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <div
          class="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-foreground"
        >
          <div class="flex items-center gap-2">
            <Clock class="size-4 text-violet-600 dark:text-violet-400" />
            Hora a hora
          </div>
          <Button
            v-if="canNovaHoraHoraMapa && !loading && selectedDate"
            type="button"
            variant="ghost"
            size="sm"
            class="h-8 gap-1 text-xs"
            @click="openNovaHoraHora"
          >
            <Plus class="size-3.5" />
            Novo
          </Button>
        </div>
        <div
          v-if="loading"
          class="rounded-lg border border-border/60 bg-muted/30 py-10 text-center text-sm text-muted-foreground"
        >
          Carregando…
        </div>
        <div
          v-else-if="!totalHoraHora"
          class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 py-8 text-center text-sm text-muted-foreground"
        >
          <span>Nenhum intervalo hora a hora neste filtro.</span>
          <Button
            v-if="canNovaHoraHoraMapa && selectedDate"
            type="button"
            variant="secondary"
            size="sm"
            class="gap-1.5"
            @click="openNovaHoraHora"
          >
            <Plus class="size-3.5" />
            Novo hora a hora
          </Button>
        </div>
        <div v-else class="flex max-h-[min(28rem,50vh)] flex-col gap-2 overflow-y-auto pr-1">
          <div
            v-for="row in horaHorasComAcumulado"
            :key="row.id"
            class="relative flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-gradient-to-br from-card to-muted/20 px-4 py-3 pr-12 shadow-sm"
          >
            <Button
              v-if="canEditProducaoMapa"
              type="button"
              variant="ghost"
              size="icon"
              class="absolute right-1 top-1 size-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Editar hora a hora"
              @click.stop="openEditHoraHora(row)"
            >
              <Pencil class="size-4" />
            </Button>
            <div class="min-w-0 flex-1">
              <p class="font-medium tabular-nums text-foreground">
                {{ labelIntervaloHora(row.hora) }}
              </p>
              <p
                class="text-xs text-muted-foreground"
              >
                Δ hora
                <span
                  :class="
                    row.diffHora > 0
                      ? 'font-medium text-emerald-600 dark:text-emerald-400'
                      : row.diffHora < 0
                        ? 'font-medium text-destructive'
                        : ''
                  "
                >
                  {{ fmtSignedMapa(row.diffHora) }}
                </span>
                · acum.
                {{ row.acumPlacas }}/{{ row.acumMeta }}
                <span
                  :class="
                    row.diffAcum > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : row.diffAcum < 0
                        ? 'text-destructive'
                        : ''
                  "
                >
                  ({{ fmtSignedMapa(row.diffAcum) }})
                </span>
              </p>
              <p
                v-if="strTrim(row.comentario)"
                class="mt-1 line-clamp-2 text-xs text-muted-foreground"
              >
                {{ row.comentario }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2 text-xs">
              <span
                class="rounded-full bg-violet-500/10 px-2.5 py-1 font-medium text-violet-700 dark:text-violet-400"
              >
                {{ row.placasProduzidas ?? 0 }} placas
              </span>
              <span
                class="rounded-full bg-muted px-2.5 py-1 text-muted-foreground"
              >
                meta {{ row.meta ?? '—' }}
              </span>
            </div>
          </div>
        </div>
      </section>
      </div>
    </template>

    <MapaProducaoModal
      v-model="producaoModalOpen"
      :preset-data="selectedDate"
      :preset-maquina="selectedMaquina"
      :edit-id="producaoEditId"
      @saved="loadDashboard"
    />
    <MapaParadaModal
      v-model="paradaModalOpen"
      :preset-data="selectedDate"
      :preset-maquina="selectedMaquina"
      :edit-id="paradaEditId"
      @saved="loadDashboard"
    />
    <MapaEstufaModal
      v-model="estufaModalOpen"
      :preset-data="selectedDate"
      :preset-maquina="selectedMaquina"
      :edit-id="estufaEditId"
      @saved="loadDashboard"
    />
    <MapaHoraHoraModal
      v-model="horaHoraModalOpen"
      :preset-data="selectedDate"
      :preset-maquina="selectedMaquina"
      :edit-id="horaHoraEditId"
      @saved="loadDashboard"
    />
  </div>
</template>
