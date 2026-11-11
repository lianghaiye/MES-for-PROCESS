<template>
  <FormComponent page-mode :list-path="listPath" />
</template>

<script setup>
import FormComponent from './components/MasterItemFormModal.vue'

defineOptions({ name: 'ProductCreateView' })

const listPath = '/product-process/products'
</script>
