<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ChevronRight, Factory, Home, LogOut, PauseCircle } from 'lucide-vue-next'
import { supabase } from '@/lib/supabase'
import { usePermissionsStore } from '@/stores/permissions'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()

const pageTitle = computed(() => (route.meta.title as string) || 'OCS Portal')

async function signOut() {
  permissionsStore.clear()
  await supabase.auth.signOut()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <SidebarProvider>
    <Sidebar collapsible="icon">
      <SidebarHeader class="border-b border-sidebar-border">
        <div class="flex items-center gap-2 px-2 py-1">
          <img
            src="/images.png"
            alt=""
            class="size-8 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border"
          />
          <div
            class="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden"
          >
            <span class="truncate font-semibold text-sidebar-foreground">OCS</span>
            <span class="truncate text-xs text-muted-foreground">Produção</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton as-child tooltip="Início">
                  <RouterLink :to="{ name: 'home' }">
                    <Home />
                    <span>Início</span>
                  </RouterLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  as-child
                  tooltip="Paradas"
                  :is-active="route.name === 'paradas'"
                >
                  <RouterLink :to="{ name: 'paradas' }">
                    <PauseCircle />
                    <span>Paradas</span>
                  </RouterLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <Collapsible default-open class="w-full">
                  <CollapsibleTrigger as-child>
                    <SidebarMenuButton class="group/trigger w-full">
                      <Factory />
                      <span>Produção</span>
                      <ChevronRight
                        class="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/trigger:rotate-90"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          as-child
                          :is-active="route.name === 'production'"
                        >
                          <RouterLink :to="{ name: 'production' }">
                            <span>Produções</span>
                          </RouterLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          as-child
                          :is-active="route.name === 'estufas'"
                        >
                          <RouterLink :to="{ name: 'estufas' }">
                            <span>Estufas</span>
                          </RouterLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          as-child
                          :is-active="route.name === 'production-mapa'"
                        >
                          <RouterLink :to="{ name: 'production-mapa' }">
                            <span>Mapa</span>
                          </RouterLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          as-child
                          :is-active="route.name === 'hora-hora'"
                        >
                          <RouterLink :to="{ name: 'hora-hora' }">
                            <span>Hora a hora</span>
                          </RouterLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter class="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton class="text-muted-foreground" @click="signOut">
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>

    <SidebarInset>
      <header
        class="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4"
      >
        <SidebarTrigger class="-ml-1" />
        <span class="text-sm font-medium text-muted-foreground">{{
          pageTitle
        }}</span>
      </header>
      <RouterView />
    </SidebarInset>
  </SidebarProvider>
</template>
