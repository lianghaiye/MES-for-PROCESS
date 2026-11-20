<template>
  <FormComponent page-mode :list-path="listPath" />
</template>

<script setup>
import FormComponent from './components/ProcessFormTemplateFormModal.vue'

defineOptions({ name: 'ProcessFormTemplateCreateView' })

const listPath = '/product-process/process-form'
</script>
