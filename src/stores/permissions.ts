import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchMyUserPermissions } from '@/lib/user-permissions'
import type { UserPermission } from '@/types/user-permission'

export const usePermissionsStore = defineStore('permissions', () => {
  const permissions = ref<UserPermission | null>(null)
  const loaded = ref(false)
  const lastError = ref<string | null>(null)

  async function load() {
    lastError.value = null
    const data = await fetchMyUserPermissions()
    permissions.value = data
    loaded.value = true
  }

  function clear() {
    permissions.value = null
    loaded.value = false
    lastError.value = null
  }

  return { permissions, loaded, lastError, load, clear }
})
