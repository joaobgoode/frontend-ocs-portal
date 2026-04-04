<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { usePermissionsStore } from '@/stores/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref<string | null>(null)

async function onSubmit() {
  errorMessage.value = null
  loading.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    })
    if (error) {
      errorMessage.value = error.message
      return
    }
    try {
      permissionsStore.clear()
      await permissionsStore.load()
    } catch (e) {
      await supabase.auth.signOut()
      errorMessage.value =
        e instanceof Error ? e.message : 'Não foi possível carregar as permissões.'
      return
    }
    const redirect = route.query.redirect
    const target =
      typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
    await router.replace(target)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10"
  >
    <div class="mb-8 flex flex-col items-center gap-3 text-center">
      <img
        src="/images.png"
        alt="OCS"
        class="h-24 w-24 rounded-full object-cover shadow-lg ring-2 ring-border"
      />
      <p class="text-sm text-muted-foreground">Portal de produção</p>
    </div>

    <Card class="w-full max-w-md border-border bg-card shadow-xl">
      <CardHeader class="space-y-1">
        <CardTitle class="text-xl tracking-tight">Entrar</CardTitle>
        <CardDescription>
          Use o e-mail e a senha cadastrados no Supabase Auth.
        </CardDescription>
      </CardHeader>
      <form @submit.prevent="onSubmit">
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="email">E-mail</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="voce@empresa.com"
              required
              class="bg-background/50"
            />
          </div>
          <div class="space-y-2">
            <Label for="password">Senha</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="bg-background/50"
            />
          </div>
          <p
            v-if="errorMessage"
            class="text-sm text-destructive"
            role="alert"
          >
            {{ errorMessage }}
          </p>
        </CardContent>
        <CardFooter>
          <Button type="submit" class="w-full" size="lg" :disabled="loading">
            {{ loading ? 'Entrando…' : 'Entrar' }}
          </Button>
        </CardFooter>
      </form>
    </Card>
  </div>
</template>
