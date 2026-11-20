<template>
  <FormComponent page-mode :list-path="listPath" />
</template>

<script setup>
import FormComponent from './components/ProductionLineFormModal.vue'

defineOptions({ name: 'ProductionLineCreateView' })

const listPath = '/product-process/production-line'
</script>
