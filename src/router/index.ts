import type { Session } from '@supabase/supabase-js'
import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { usePermissionsStore } from '@/stores/permissions'

/** Evita tela em branco se getSession() demorar ou falhar (ex.: rede / URL inválida). */
function getSessionWithTimeout(ms: number): Promise<Session | null> {
  return new Promise((resolve) => {
    const done = (session: Session | null) => resolve(session)
    const timer = window.setTimeout(() => done(null), ms)
    supabase.auth
      .getSession()
      .then(({ data }) => {
        window.clearTimeout(timer)
        done(data.session)
      })
      .catch(() => {
        window.clearTimeout(timer)
        done(null)
      })
  })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeDashboard.vue'),
          meta: { title: 'Início' },
        },
        {
          path: 'producao',
          name: 'production',
          component: () => import('@/views/ProductionView.vue'),
          meta: { title: 'Produção' },
        },
        {
          path: 'estufas',
          name: 'estufas',
          component: () => import('@/views/EstufasView.vue'),
          meta: { title: 'Estufas' },
        },
        {
          path: 'producao/mapa',
          name: 'production-mapa',
          component: () => import('@/views/MapaProducaoView.vue'),
          meta: { title: 'Mapa' },
        },
        {
          path: 'producao/hora-hora',
          name: 'hora-hora',
          component: () => import('@/views/HoraHoraView.vue'),
          meta: { title: 'Hora a hora' },
        },
        {
          path: 'paradas',
          name: 'paradas',
          component: () => import('@/views/ParadasView.vue'),
          meta: { title: 'Paradas' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  const session = await getSessionWithTimeout(5000)

  if (to.meta.requiresAuth && !session) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && session) {
    return { name: 'home' }
  }

  if (to.meta.requiresAuth && session) {
    const permissionsStore = usePermissionsStore()
    if (!permissionsStore.loaded) {
      try {
        await permissionsStore.load()
      } catch (e) {
        console.error('[permissions] falha ao carregar na navegação:', e)
      }
    }
  }

  return true
})

export default router
