import { useRoute, useRouter } from 'vue-router'
import { useTabs } from '@/composables/useTabs'

/** 仅允许站内相对路径，避免 open-redirect */
function sanitizeReturnTo(raw) {
  const value = String(raw || '').trim()
  if (!value.startsWith('/') || value.startsWith('//')) return ''
  return value
}

/** 表单新增页：取消/保存后关闭 Tab 并返回列表（或 query.returnTo 指定页，如详情） */
export function useFormCreatePage(listPath) {
  const route = useRoute()
  const router = useRouter()
  const { closeTab, openTab, tabState, getTabNavigateTo } = useTabs()

  function resolveListPath() {
    if (typeof listPath === 'function') return listPath()
    if (listPath) return listPath
    return route.meta?.listPath || '/home/dashboard'
  }

  function resolveBackPath() {
    const returnTo = sanitizeReturnTo(route.query?.returnTo)
    if (returnTo) return returnTo
    return resolveListPath()
  }

  function goBack() {
    const target = resolveBackPath()
    const title = String(route.query?.returnTitle || '').trim()
    closeTab(route.fullPath || route.path)
    if (title) openTab(target, title)
    else openTab(target)
    router.push(target)
  }

  /** 只读详情：关标签后留在其余已打开的页（如从 BOM 点进来则回到 BOM） */
  function closeToActiveTab() {
    closeTab(route.path)
    router.push(getTabNavigateTo(tabState.activePath))
  }

  return { goBack, closeToActiveTab, resolveListPath, resolveBackPath }
}
