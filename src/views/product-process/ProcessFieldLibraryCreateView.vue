<template>
  <FormComponent page-mode :list-path="listPath" />
</template>

<script setup>
import FormComponent from './components/ProcessFieldLibraryFormModal.vue'

defineOptions({ name: 'ProcessFieldLibraryCreateView' })

const listPath = '/product-process/process-field-library'
</script>
