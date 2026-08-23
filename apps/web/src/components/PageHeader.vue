<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>
<template>
  <div class="page-toolbar">
    <div>
      <h2>{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
    </div>
    <div class="toolbar-actions"><slot /></div>
  </div>
</template>
