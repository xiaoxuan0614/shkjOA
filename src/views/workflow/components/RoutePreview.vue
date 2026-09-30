<template>
  <section class="route-preview" aria-label="审批路线预览">
    <header><h3>审批路线预览</h3><span>提交前预览</span></header>
    <a-alert v-if="unsupported" type="warning" message="当前返回包含分支结构，暂无法确认连线关系，未将其按串行路线展示。" show-icon />
    <a-alert v-else-if="!nodes" type="warning" message="预览数据格式不完整，请重新预览。" show-icon />
    <div v-else class="route-canvas">
      <div class="terminal"><span class="start-dot"></span>发起申请</div>
      <template v-for="node in nodes" :key="node.nodeKey">
        <div class="connector" aria-hidden="true"></div>
        <article class="route-node" :class="{ skipped: !node.selected, work: node.kind === 'WORK' }">
          <div class="node-heading"
            ><strong>{{ node.name }}</strong
            ><span>{{ kinds[node.kind] || node.kind }}</span></div
          >
          <div class="node-body"
            ><div class="node-meta"
              ><span>{{ modes[node.mode] || node.mode || '默认审批方式' }}</span
              ><span :class="node.selected ? 'selected-label' : 'skipped-label'">{{ node.selected ? '本次经过' : '本次跳过' }}</span></div
            >
            <div v-if="node.selected && node.userIds.length" class="people"
              ><span v-for="id in node.userIds" :key="id" class="person"><UserOutlined />{{ names[id] || `人员 ID：${id}` }}</span></div
            >
            <p v-else-if="node.selected" class="empty-people">未返回处理人员</p>
          </div>
        </article>
      </template>
      <div class="connector" aria-hidden="true"></div><div class="terminal"><CheckCircleOutlined class="end-icon" />流程结束</div>
    </div>
    <p class="notice">{{ typeof value.notice === 'string' ? value.notice : '预览基于当前数据，实际激活节点时重新校验审批人。' }}</p>
  </section>
</template>
<script setup lang="ts">
  import { computed, ref, watch, onBeforeUnmount } from 'vue';
  import { UserOutlined, CheckCircleOutlined } from '@ant-design/icons-vue';
  import { directory } from '../Workflow.api';
  const props = defineProps<{ value: Record<string, unknown> }>();
  interface PreviewNode {
    name: string;
    nodeKey: string;
    kind: string;
    mode: string;
    selected: boolean;
    userIds: string[];
  }
  const unsupported = computed(() => props.value.stages != null);
  const nodes = computed<PreviewNode[] | null>(() => {
    const rows = props.value.nodes;
    if (
      !Array.isArray(rows) ||
      rows.some(
        (n) =>
          !n ||
          typeof n.name !== 'string' ||
          typeof n.nodeKey !== 'string' ||
          typeof n.selected !== 'boolean' ||
          !Array.isArray(n.userIds) ||
          n.userIds.some((id) => typeof id !== 'string')
      )
    )
      return null;
    return rows;
  });
  const kinds: Record<string, string> = { APPROVAL: '审批', CC: '抄送', NOTICE: '通知', WORK: '人工任务' };
  const modes: Record<string, string> = {
    ANY: '或签 · 一人通过',
    ALL: '会签 · 全员通过',
    COUNT: '按人数通过',
    PERCENT: '按比例通过',
    SEQUENTIAL: '依次审批',
  };
  const names = ref<Record<string, string>>({});
  let generation = 0;
  watch(
    nodes,
    async (rows) => {
      const current = ++generation;
      if (unsupported.value || !rows) return;
      const missing = new Set(
        rows
          .filter((n) => n.selected)
          .flatMap((n) => n.userIds)
          .filter((id) => !names.value[id])
      );
      try {
        let page = 1;
        while (missing.size) {
          const result = await directory('users', '', page);
          if (current !== generation) return;
          for (const item of result.records) {
            if (missing.has(item.id)) {
              names.value[item.id] = item.name || item.username || item.id;
              missing.delete(item.id);
            }
          }
          if (!result.records.length || page * 30 >= result.total) break;
          page++;
        }
      } catch {
        /* Keep returned IDs visible if the directory is unavailable. */
      }
    },
    { immediate: true }
  );
  onBeforeUnmount(() => generation++);
</script>
<style scoped>
  .route-preview {
    margin-top: 24px;
    border: 1px solid #e5e8ef;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #edf0f5;
  }
  h3 {
    font-size: 15px;
    margin: 0;
    font-weight: 600;
  }
  header > span {
    font-size: 12px;
    color: #687387;
  }
  .route-canvas {
    background: #f7f8fc;
    padding: 24px 16px;
    max-height: 560px;
    overflow: auto;
    display: flex;
    align-items: center;
    flex-direction: column;
  }
  .terminal {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #465066;
  }
  .start-dot {
    width: 10px;
    height: 10px;
    background: #6366d9;
    border-radius: 50%;
  }
  .end-icon {
    color: #15966b;
  }
  .connector {
    height: 32px;
    min-height: 32px;
    width: 1px;
    background: #c4cbdb;
    position: relative;
  }
  .connector::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: -3px;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid #a9b3c7;
  }
  .route-node {
    width: min(360px, 100%);
    border: 1px solid #dce0ef;
    border-radius: 6px;
    background: white;
    flex-shrink: 0;
    overflow: hidden;
  }
  .node-heading {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    background: #eef0ff;
    border-left: 3px solid #6366d9;
    padding: 10px 14px;
  }
  .node-heading strong {
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .node-heading > span {
    font-size: 12px;
    color: #525d83;
    white-space: nowrap;
  }
  .node-body {
    padding: 12px 16px;
  }
  .node-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: #5c667a;
  }
  .selected-label {
    color: #4256bc;
  }
  .skipped-label {
    color: #687387;
  }
  .people {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .person {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 12px;
    background: #f0f2fc;
    font-size: 12px;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  .skipped {
    border-style: dashed;
  }
  .skipped .node-heading {
    background: #f2f3f5;
    border-left-color: #a8aebb;
  }
  .work .node-heading {
    background: #eef7f2;
    border-left-color: #28a075;
  }
  .empty-people {
    font-size: 12px;
    color: #687387;
    margin: 10px 0 0;
  }
  .notice {
    padding: 12px 16px;
    margin: 0;
    color: #687387;
    font-size: 12px;
    line-height: 1.6;
  }
</style>
