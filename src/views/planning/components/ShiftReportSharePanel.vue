<template>
  <div class="share-panel">
    <a-alert
      type="info"
      show-icon
      class="share-tip"
      message="复制文字可直接粘贴到微信群；或对下方预览卡片截图发送。"
    />
    <a-space class="share-actions" :size="8">
      <a-button type="primary" size="small" @click="copyText">复制文字</a-button>
      <a-button size="small" @click="copyAndTip">复制并发群提示</a-button>
    </a-space>
    <div ref="cardRef" class="share-card">
      <div class="share-card-title">{{ title }}</div>
      <div class="share-card-date">{{ dateLabel }}</div>
      <pre class="share-card-body">{{ text }}</pre>
      <div class="share-card-foot">
        填报人 {{ record?.reporter || '—' }} · {{ record?.updatedAt || '—' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import {
  SHIFT_LABEL,
  WORKSHOP_LABEL,
  formatShiftReportPreview,
} from '@/store/shiftEnergyReportStore'

const props = defineProps({
  record: { type: Object, default: null },
})

const cardRef = ref(null)

const text = computed(() => formatShiftReportPreview(props.record))
const title = computed(() => {
  const w = props.record?.workCenterName || WORKSHOP_LABEL[props.record?.workshop] || '工作中心'
  const s = SHIFT_LABEL[props.record?.shift] || ''
  return `${w}${s}工作汇报`
})
const dateLabel = computed(() => {
  const d = props.record?.date
  if (!dayjs(d).isValid()) return d || '—'
  return `${dayjs(d).month() + 1}月${dayjs(d).date()}日`
})

async function copyText() {
  const content = text.value
  if (!content) {
    message.warning('暂无内容可复制')
    return
  }
  try {
    await navigator.clipboard.writeText(content)
    message.success('已复制，可粘贴到微信群')
  } catch {
    message.error('复制失败，请手动选择预览文字')
  }
}

async function copyAndTip() {
  await copyText()
  message.info('建议：手机端打开本预览后截图，发群更清晰')
}
</script>

<style scoped lang="less">
.share-tip {
  margin-bottom: 12px;
}
.share-actions {
  margin-bottom: 12px;
}
.share-card {
  padding: 16px;
  background: #f7f8fa;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}
.share-card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
  line-height: 24px;
}
.share-card-date {
  margin-top: 4px;
  font-size: 13px;
  color: #4e5969;
}
.share-card-body {
  margin: 12px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.75;
  color: #1f2329;
  font-family: inherit;
}
.share-card-foot {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px dashed #e8e8e8;
  font-size: 12px;
  color: #86909c;
}
</style>
