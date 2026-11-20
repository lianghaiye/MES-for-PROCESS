import { spuState, addSpu, updateSpu } from '@/store/spuStore'
import { upsertSkuForSpu } from '@/utils/spuSkuSave'
import { PROCESS_FAMILY_SEEDS, PROCESS_FAMILY_SKUS } from '@/mock/processFamilySeed'
import { isLegacyPumpMaster } from '@/utils/legacyPumpMaster'

const SPU_STORAGE_KEY = 'i_doms_spus_v1'

function ensureProcessFamilies() {
  const kept = (spuState.spus || []).filter((row) => !isLegacyPumpMaster(row))
  spuState.spus = kept
  PROCESS_FAMILY_SEEDS.forEach((seed) => {
    const existing = spuState.spus.find((row) => row.id === seed.id)
    if (!existing) addSpu(seed)
    else updateSpu(seed.id, seed)
  })
  localStorage.setItem(SPU_STORAGE_KEY, JSON.stringify(spuState.spus))
}

function ensureFamilySkus() {
  PROCESS_FAMILY_SKUS.forEach((group) => {
    group.items.forEach((item) => {
      upsertSkuForSpu(
        group.spuId,
        { specModel: item.specModel, material: item.material },
        {
          code: item.code,
          content: item.content,
          density: item.density,
        },
      )
    })
  })
}

/** 清掉泵族，并保证流程型产品族和 SKU 在列表里。 */
export function bootstrapSpuSkuData() {
  ensureProcessFamilies()
  ensureFamilySkus()
}
