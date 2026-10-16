<template>
  <div class="material-identity-cell">
    <button v-if="materialId" type="button" class="material-identity-cell__name material-identity-cell__link" @click.stop="showDetail">
      {{ name }}<template v-if="brand">（{{ brand }}）</template>
    </button>
    <span v-else class="material-identity-cell__name">{{ name }}<template v-if="brand">（{{ brand }}）</template></span>
    <span class="material-identity-cell__code" :class="{ 'material-identity-cell__model': secondaryField === 'model' }" :title="secondaryField === 'model' ? String(record.model || '暂无型号') : undefined">{{ secondaryField === 'model' ? (record.model || '暂无型号') : (record.materialCode || '暂无编码') }}</span>
    <slot />
    <MaterialBasicInfoModal v-if="detailMounted" ref="detailRef" />
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, ref } from 'vue';
  import MaterialBasicInfoModal from './MaterialBasicInfoModal.vue';
  import { materialIdentity, loadMaterialBrandNames } from '../materialIdentity';

  const props = withDefaults(defineProps<{ record: Record<string, any>; source?: 'master' | 'detail'; nameField?: string; secondaryField?: 'materialCode' | 'model' }>(), {
    source: 'detail', nameField: 'materialName', secondaryField: 'model',
  });
  const brands = ref<Record<string, { text: string }>>({});
  onMounted(async () => { brands.value = await loadMaterialBrandNames(); });
  const identity = computed(() => materialIdentity(props.record, props.source, props.nameField, brands.value));
  const name = computed(() => identity.value.name);
  const brand = computed(() => identity.value.brand);
  const materialId = computed(() => identity.value.materialId);
  const detailMounted = ref(false);
  const detailRef = ref<InstanceType<typeof MaterialBasicInfoModal>>();
  async function showDetail() {
    if (!materialId.value) return;
    detailMounted.value = true;
    await nextTick();
    detailRef.value?.open({ materialId: materialId.value });
  }
</script>

<style scoped>
  .material-identity-cell { display: flex; flex-direction: column; gap: 4px; min-width: 0; text-align: left; overflow-wrap: anywhere; white-space: normal; }
  .material-identity-cell__name { color: inherit; font: inherit; font-weight: 500; line-height: 1.5; }
  .material-identity-cell__link { display: block; border: 0; padding: 0; background: none; text-align: left; cursor: pointer; overflow-wrap: anywhere; white-space: normal; }
  .material-identity-cell__link:hover { color: #1677ff; }
  .material-identity-cell__link:focus-visible { outline: 2px solid #1677ff; outline-offset: 2px; border-radius: 2px; }
  .material-identity-cell__model { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; text-overflow: ellipsis; }
  .material-identity-cell__code { font-size: 12px; line-height: 1.5; opacity: .75; }
</style>
