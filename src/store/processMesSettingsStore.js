import {
  ROUTE_MODE_EQUIPMENT,
  ROUTE_MODE_OPTIONS,
  ROUTE_MODE_PROCESS,
  formatRouteModeLabel,
  normalizeRouteMode,
} from '@/constants/processRouteMode'
import { getProcessRouteMode, setProcessRouteMode } from '@/store/functionParamStore'

export {
  ROUTE_MODE_EQUIPMENT,
  ROUTE_MODE_OPTIONS,
  ROUTE_MODE_PROCESS,
  formatRouteModeLabel,
  normalizeRouteMode,
}

/** @deprecated 请改用功能参数里的工艺路线模式；此处转发到 functionParamStore */
export const processMesSettingsState = {
  get routeMode() {
    return getProcessRouteMode()
  },
  set routeMode(value) {
    setProcessRouteMode(value)
  },
}

export function getRouteMode() {
  return getProcessRouteMode()
}

export function setRouteMode(value) {
  setProcessRouteMode(value)
  return getProcessRouteMode()
}

/** 编辑某条路线时：优先用路线自己记下的模式，没有则用功能参数 */
export function resolveRouteEditMode(route) {
  if (route?.routeMode) return normalizeRouteMode(route.routeMode)
  return getRouteMode()
}
