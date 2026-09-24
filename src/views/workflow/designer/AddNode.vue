<template>
  <div class="add-connector">
    <a-popover v-model:open="open" trigger="click" placement="right" overlay-class-name="workflow-node-menu">
      <template #content
        ><div class="node-menu"
          ><button v-for="item in kinds" :key="item.kind" type="button" @click="choose(item.kind)"
            ><span :style="{ background: item.color }"><component :is="icons[item.icon]" /></span>{{ item.label
            }}{{ ['CC', 'NOTICE', 'TASK'].includes(item.kind) ? '（仅设计）' : '' }}</button
          ></div
        ></template
      >
      <button class="insert-node" :disabled="disabled" type="button" aria-label="添加节点" @click.stop><PlusOutlined /></button>
    </a-popover>
  </div>
</template>
<script setup lang="ts">
  import { ref } from 'vue';
  import {
    PlusOutlined,
    UserOutlined,
    SendOutlined,
    BranchesOutlined,
    PartitionOutlined,
    NotificationOutlined,
    ProfileOutlined,
  } from '@ant-design/icons-vue';
  import { kinds } from './graph';
  import type { NodeKind } from './graph';
  defineProps<{ disabled?: boolean }>();
  const emit = defineEmits<{ (e: 'add', kind: NodeKind): void }>();
  const open = ref(false);
  const icons = {
    user: UserOutlined,
    send: SendOutlined,
    branches: BranchesOutlined,
    partition: PartitionOutlined,
    notice: NotificationOutlined,
    task: ProfileOutlined,
  };
  function choose(kind: NodeKind) {
    open.value = false;
    emit('add', kind);
  }
</script>
<style scoped>
  .add-connector {
    height: 76px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .add-connector:before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #dcdfe8;
  }
  .insert-node {
    position: relative;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    color: #6668d9;
    cursor: pointer;
    display: grid;
    place-items: center;
    box-shadow: 0 2px 7px #2331570d;
  }
  .insert-node:hover {
    background: #6868e7;
    color: #fff;
  }
  .insert-node:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .node-menu {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 4px;
    width: 276px;
  }
  .node-menu button {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 9px 6px;
    border: 0;
    background: white;
    text-align: left;
    cursor: pointer;
    color: #303443;
    font-size: 13px;
  }
  .node-menu button:hover {
    background: #f5f5fc;
  }
  .node-menu span {
    display: grid;
    place-items: center;
    width: 29px;
    height: 29px;
    border-radius: 50%;
    color: white;
    font-size: 15px;
  }
  button:focus-visible {
    outline: 2px solid #6266dc !important;
    outline-offset: 3px;
  }
</style>
