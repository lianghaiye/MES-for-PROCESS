import { reactive, watch } from 'vue'
import { createProcessDocSeed } from '@/mock/processDocSeed'
import { persistJson, safeSetItem } from '@/utils/safeStorage'

const STORAGE_KEY = 'i_doms_process_docs'
const SEED_VERSION_KEY = 'i_doms_process_docs_seed_v'
const CURRENT_SEED_VERSION = '2'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.docs)) return parsed.docs
    }
  } catch {
    /* ignore */
  }
  return null
}

function shouldReseed() {
  return localStorage.getItem(SEED_VERSION_KEY) !== CURRENT_SEED_VERSION
}

function persist() {
  persistJson(STORAGE_KEY, { docs: processDocState.docs })
  safeSetItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
}

export const processDocState = reactive({
  docs: shouldReseed() ? createProcessDocSeed() : loadFromStorage() || createProcessDocSeed(),
})

watch(
  () => processDocState.docs,
  () => persist(),
  { deep: true },
)
persist()

export function getProcessDocById(id) {
  return processDocState.docs.find((d) => d.id === id) || null
}

export function getEnabledProcessDocs() {
  return processDocState.docs.filter((d) => d.status === '启用')
}

export function filterProcessDocs(list, filters = {}) {
  return list.filter((d) => {
    if (filters.name && !d.name.includes(filters.name)) return false
    if (filters.code && !d.code.includes(filters.code)) return false
    return true
  })
}
