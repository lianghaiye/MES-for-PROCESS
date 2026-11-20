/** 工序网格：格子是工序，格上挂设备 */
export const ROUTE_MODE_PROCESS = 'process'
/** 设备顺序：只排设备，配方阶段再挂工序 */
export const ROUTE_MODE_EQUIPMENT = 'equipment'

export const ROUTE_MODE_OPTIONS = [
  {
    value: ROUTE_MODE_PROCESS,
    label: '工艺路线',
    desc: '格子是工序，每格再挂设备。渣、母液回流写回到哪一格。',
  },
  {
    value: ROUTE_MODE_EQUIPMENT,
    label: '设备顺序',
    desc: '只排设备顺序。配方阶段仍选工序，设备从这条顺序里选。',
  },
]

export function normalizeRouteMode(value) {
  return value === ROUTE_MODE_EQUIPMENT ? ROUTE_MODE_EQUIPMENT : ROUTE_MODE_PROCESS
}

export function formatRouteModeLabel(value) {
  return (
    ROUTE_MODE_OPTIONS.find((item) => item.value === normalizeRouteMode(value))?.label || '工艺路线'
  )
}
