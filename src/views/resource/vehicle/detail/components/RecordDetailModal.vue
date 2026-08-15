<template>
  <BasicModal v-bind="$attrs" @register="register" destroyOnClose :title="recordTitle" :width="640" :footer="null">
    <a-descriptions :column="2" bordered size="middle">
      <a-descriptions-item
        v-for="(f, idx) in recordFields"
        :key="idx"
        :label="f.label"
        :span="f.span || 1"
      >
        <!-- 照片: 图片预览 -->
        <template v-if="f.type === 'images'">
          <div v-if="getImages(f.value).length" class="record-detail__images">
            <a-image
              v-for="(img, i) in getImages(f.value)"
              :key="i"
              :src="img"
              :width="80"
              :height="80"
              style="margin-right: 8px; object-fit: cover; border-radius: 4px"
            />
          </div>
          <span v-else>—</span>
        </template>
        <span v-else>{{ f.value || '—' }}</span>
      </a-descriptions-item>
    </a-descriptions>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';

  const props = defineProps<{
    recordTitle: string;
    recordFields: any[];
  }>();

  // 弹窗标题(父组件通过 props 传入, 这里直接用)
  const titleRef = ref(props.recordTitle);

  const [register] = useModalInner(() => {
    titleRef.value = props.recordTitle;
  });

  /**
   * 图片值可能是逗号分隔字符串或数组
   */
  function getImages(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return String(val)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
</script>

<style lang="less" scoped>
  .record-detail {
    &__images {
      display: flex;
      flex-wrap: wrap;
    }
  }
</style>
