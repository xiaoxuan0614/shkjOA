<template>
  <section class="workflow-canvas" :class="{ fullscreen }">
    <div class="canvas-tools" aria-label="画布工具栏">
      <a-tooltip title="缩小"
        ><button aria-label="缩小画布" :disabled="zoom <= 0.25" @click="setZoom(zoom - 0.1)"><MinusOutlined /></button
      ></a-tooltip>
      <button class="zoom-value" aria-label="恢复100%" @click="setZoom(1)">{{ Math.round(zoom * 100) }}%</button>
      <a-tooltip title="放大"
        ><button aria-label="放大画布" :disabled="zoom >= 2" @click="setZoom(zoom + 0.1)"><PlusOutlined /></button
      ></a-tooltip>
      <span class="tool-divider"></span
      ><a-tooltip title="适应画布"
        ><button aria-label="适应画布" @click="fit"><CompressOutlined /></button
      ></a-tooltip>
      <a-tooltip title="回到发起节点"
        ><button aria-label="回到发起节点" @click="center"><AimOutlined /></button
      ></a-tooltip>
      <a-tooltip :title="fullscreen ? '退出全屏' : '全屏画布'"
        ><button :aria-label="fullscreen ? '退出全屏画布' : '全屏画布'" @click="fullscreen = !fullscreen"
          ><FullscreenExitOutlined v-if="fullscreen" /><FullscreenOutlined v-else /></button
      ></a-tooltip>
    </div>
    <span class="pan-hint">拖动空白处移动画布 · Ctrl / ⌘ + 滚轮缩放</span>
    <div
      ref="viewport"
      class="canvas-viewport"
      :class="{ dragging }"
      @pointerdown="startPan"
      @pointermove="movePan"
      @pointerup="endPan"
      @pointercancel="endPan"
      @wheel="wheel"
    >
      <div class="zoom-space" :style="{ width: `${Math.max(size.width * zoom + 160, viewportWidth)}px`, height: `${size.height * zoom + 180}px` }">
        <div ref="stage" class="diagram-stage" :style="{ transform: `translateX(-50%) scale(${zoom})` }">
          <article ref="starterCard" class="starter-card" :class="{ selected: editingStarter }"
            ><button @click="openStarter"
              ><strong>发起人<UserOutlined /></strong><span>{{ starterSummary }}<RightOutlined /></span></button
          ></article>
          <FlowSequence v-model:nodes="nodes" :readonly="readonly" :selected="selected" @select="openNode" @changed="emit('changed')" />
          <div class="end-node"><CheckSquareOutlined /><span>流程结束</span></div>
        </div>
      </div>
    </div>
    <a-drawer
      :open="!!editing || editingStarter"
      :width="'min(1080px, 82vw)'"
      :closable="false"
      :mask-closable="false"
      :keyboard="false"
      root-class-name="workflow-settings-drawer"
      @close="cancel"
    >
      <template #title
        ><div class="settings-title"
          ><a-input v-if="editing" v-model:value="editingName" :disabled="readonly" :bordered="false" :maxlength="100" aria-label="节点名称" /><span
            v-else
            >发起人</span
          ><EditOutlined /><button aria-label="关闭节点设置" @click="cancel"><CloseOutlined /></button></div
      ></template>
      <a-config-provider :component-disabled="readonly">
        <template v-if="editingStarter">
          <h3 class="section-label">参与者可以看见或者操作哪些字段</h3
          ><FieldPermissions :fields="definition.formFields || []" v-model:value="starterFields" />
          <a-collapse ghost class="starter-scope"
            ><a-collapse-panel key="scope" header="发起范围"
              ><a-form layout="vertical"><AudienceEditor v-model:value="starterAudience" /></a-form></a-collapse-panel
          ></a-collapse>
        </template>
        <FlowSettings
          v-else-if="editing"
          :key="editingLane?.id || editing.id"
          v-model:node="editing"
          v-model:lane="editingLane"
          :fields="definition.formFields || []"
        />
      </a-config-provider>
      <template #footer
        ><div class="settings-actions"
          ><a-button type="primary" :disabled="readonly" @click="apply">保存</a-button
          ><a-button :disabled="false" @click="cancel">{{ readonly ? '关闭' : '取消' }}</a-button
          ><span v-if="editing && ['CC', 'NOTICE', 'TASK'].includes(editing.kind)" class="design-only">保存到设计稿，尚未接入发布</span></div
        ></template
      >
    </a-drawer>
  </section>
</template>
<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
  import { Modal } from 'ant-design-vue';
  import {
    PlusOutlined,
    MinusOutlined,
    CompressOutlined,
    AimOutlined,
    FullscreenOutlined,
    FullscreenExitOutlined,
    UserOutlined,
    RightOutlined,
    CheckSquareOutlined,
    CloseOutlined,
    EditOutlined,
  } from '@ant-design/icons-vue';
  import FlowSequence from './FlowSequence.vue';
  import FlowSettings from './FlowSettings.vue';
  import FieldPermissions from './FieldPermissions.vue';
  import AudienceEditor from '../components/AudienceEditor.vue';
  import { clone, flatten } from './graph';
  import type { DesignNode, DesignBranch } from './graph';
  import type { WorkflowDefinition, Audience, FieldPermission } from '../workflow.types';
  const props = defineProps<{ readonly?: boolean }>();
  const nodes = defineModel<DesignNode[]>('nodes', { required: true });
  const definition = defineModel<WorkflowDefinition>('definition', { required: true });
  const emit = defineEmits<{ (e: 'changed'): void }>();
  const viewport = ref<HTMLElement>(),
    stage = ref<HTMLElement>(),
    starterCard = ref<HTMLElement>(),
    zoom = ref(1),
    fullscreen = ref(false),
    dragging = ref(false),
    viewportWidth = ref(900),
    size = ref({ width: 400, height: 600 });
  let observer: ResizeObserver | undefined, pan: { x: number; y: number; left: number; top: number } | undefined;
  const editing = ref<DesignNode>(),
    editingLane = ref<DesignBranch>(),
    editingStarter = ref(false),
    selected = ref('');
  const starterFields = ref<Record<string, FieldPermission>>({}),
    starterAudience = ref<Audience>({});
  let original = '';
  const starterSummary = computed(() =>
    Object.values(definition.value.policy?.starters || {}).some((v) => Array.isArray(v) && v.length) ? '已设置发起范围' : '所有人可发起'
  );
  const editingName = computed({
    get: () => editingLane.value?.name || editing.value?.name || '',
    set: (v) => {
      if (editingLane.value) editingLane.value.name = v;
      else if (editing.value) editing.value.name = v;
    },
  });
  function openNode(node: DesignNode, lane?: DesignBranch) {
    editing.value = clone(node);
    editingLane.value = lane ? editing.value.branches?.find((b) => b.id === lane.id) : undefined;
    selected.value = lane?.id || node.id;
    original = JSON.stringify(editing.value);
  }
  function openStarter() {
    editingStarter.value = true;
    selected.value = 'starter';
    starterFields.value = clone(definition.value.policy?.initiatorFields || {});
    starterAudience.value = clone(definition.value.policy?.starters || {});
    original = JSON.stringify([starterFields.value, starterAudience.value]);
  }
  function close() {
    editing.value = undefined;
    editingLane.value = undefined;
    editingStarter.value = false;
    selected.value = '';
  }
  function cancel() {
    const current = editingStarter.value ? JSON.stringify([starterFields.value, starterAudience.value]) : JSON.stringify(editing.value);
    if (!props.readonly && current !== original) {
      Modal.confirm({ title: '放弃本次节点修改？', okText: '放弃修改', cancelText: '继续编辑', onOk: close });
    } else close();
  }
  function apply() {
    if (props.readonly) return;
    if (editing.value) {
      const target = flatten(nodes.value).find((n) => n.id === editing.value!.id);
      if (target) {
        Object.assign(target, clone(editing.value));
        if (target.approval) target.approval.name = target.name;
      }
    } else if (editingStarter.value) {
      definition.value.policy ||= {};
      definition.value.policy.initiatorFields = clone(starterFields.value);
      definition.value.policy.starters = clone(starterAudience.value);
    }
    emit('changed');
    close();
  }
  function setZoom(value: number) {
    const el = viewport.value;
    if (!el) return;
    const old = zoom.value;
    const centerX = (el.scrollLeft + el.clientWidth / 2) / old,
      centerY = (el.scrollTop + el.clientHeight / 2) / old;
    zoom.value = Math.max(0.25, Math.min(2, Math.round(value * 100) / 100));
    nextTick(() => {
      el.scrollLeft = centerX * zoom.value - el.clientWidth / 2;
      el.scrollTop = centerY * zoom.value - el.clientHeight / 2;
    });
  }
  function fit() {
    const el = viewport.value;
    if (!el) return;
    setZoom(Math.min((el.clientWidth - 160) / size.value.width, (el.clientHeight - 180) / size.value.height, 1));
    nextTick(center);
  }
  function center() {
    nextTick(() => {
      const el = viewport.value,
        card = starterCard.value;
      if (!el || !card) return;
      const bounds = el.getBoundingClientRect(),
        target = card.getBoundingClientRect();
      el.scrollTo({ left: Math.max(0, el.scrollLeft + target.left - bounds.left + target.width / 2 - el.clientWidth / 2), top: 0, behavior: 'auto' });
    });
  }
  function wheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(zoom.value + (e.deltaY < 0 ? 0.1 : -0.1));
    }
  }
  function startPan(e: PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,input,select,textarea,.canvas-node,.branch-card')) return;
    const el = viewport.value!;
    pan = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    dragging.value = true;
    el.setPointerCapture(e.pointerId);
  }
  function movePan(e: PointerEvent) {
    if (!pan || !viewport.value) return;
    viewport.value.scrollLeft = pan.left - e.clientX + pan.x;
    viewport.value.scrollTop = pan.top - e.clientY + pan.y;
  }
  function endPan() {
    pan = undefined;
    dragging.value = false;
  }
  onMounted(() => {
    observer = new ResizeObserver(() => {
      const previousWidth = size.value.width;
      if (stage.value) size.value = { width: stage.value.offsetWidth, height: stage.value.offsetHeight };
      const width = viewport.value?.clientWidth || 900;
      if (width !== viewportWidth.value || previousWidth !== size.value.width) {
        viewportWidth.value = width;
        nextTick(center);
      }
    });
    if (stage.value) observer.observe(stage.value);
    if (viewport.value) observer.observe(viewport.value);
    nextTick(center);
  });
  onBeforeUnmount(() => observer?.disconnect());
</script>
<style scoped>
  .workflow-canvas {
    position: relative;
    height: calc(100vh - 250px);
    min-height: 420px;
    background: #f7f8fc;
    overflow: hidden;
    color: #3e4355;
    font-size: 13px;
    --accent: #7371e6;
  }
  .workflow-canvas.fullscreen {
    position: fixed;
    inset: 0;
    z-index: 1000;
    height: 100vh;
  }
  .canvas-viewport {
    height: 100%;
    overflow: auto;
    cursor: grab;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: #d5d7e4 #f7f8fc;
  }
  .canvas-viewport.dragging {
    cursor: grabbing;
    user-select: none;
  }
  .zoom-space {
    position: relative;
    min-width: 100%;
  }
  .diagram-stage {
    position: absolute;
    top: 80px;
    left: 50%;
    transform-origin: top center;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: max-content;
    padding: 0 40px 40px;
  }
  .canvas-tools {
    position: absolute;
    right: 24px;
    top: 20px;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 3px;
    background: #fff;
    border: 1px solid #e8e9f1;
    border-radius: 4px;
    padding: 4px;
  }
  .canvas-tools button {
    border: 0;
    background: white;
    color: #686b7a;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .canvas-tools button:hover {
    background: #f0f0fa;
    color: #6865d4;
  }
  .canvas-tools .zoom-value {
    width: 52px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .tool-divider {
    height: 16px;
    width: 1px;
    background: #e8e9ef;
    margin: 0 4px;
  }
  .pan-hint {
    position: absolute;
    bottom: 14px;
    left: 20px;
    z-index: 4;
    font-size: 11px;
    color: #838899;
    pointer-events: none;
  }
  .starter-card {
    width: 200px;
    background: white;
    border-radius: 2px;
    box-shadow: 0 2px 8px #26334d08;
  }
  .starter-card button {
    border: 0;
    background: none;
    width: 100%;
    padding: 0;
    text-align: left;
    cursor: pointer;
  }
  .starter-card strong {
    height: 40px;
    background: linear-gradient(100deg, #4e568c, #898ea6);
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: white;
    padding: 0 14px;
    font-weight: 500;
  }
  .starter-card button > span {
    min-height: 56px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    font-size: 12px;
    color: #545b6c;
  }
  .selected {
    outline: 2px solid #7875ee;
    outline-offset: 3px;
  }
  .end-node {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #9b9eae;
    font-size: 13px;
  }
  .settings-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    color: #272d40;
  }
  .settings-title .ant-input {
    width: 260px;
    padding-left: 0;
    font-weight: 600;
  }
  .settings-title button {
    margin-left: auto;
    border: 0;
    background: none;
    padding: 6px;
    cursor: pointer;
  }
  .settings-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 0;
  }
  .settings-actions > .ant-btn {
    min-width: 80px;
  }
  .design-only {
    font-size: 12px;
    color: #777d8c;
  }
  .section-label {
    font-size: 14px;
    font-weight: 600;
    margin: 18px 0 28px;
    border-left: 3px solid #7774e9;
    padding-left: 10px;
    color: #303448;
  }
  .starter-scope {
    max-width: 720px;
    margin-top: 40px;
  }
  button:focus-visible {
    outline: 2px solid #6266dc !important;
    outline-offset: 3px;
  }
  @media (max-width: 760px) {
    .canvas-tools {
      right: 10px;
      top: 10px;
    }
    .pan-hint {
      display: none;
    }
  }
</style>
<style>
  .workflow-settings-drawer .ant-drawer-header {
    border: 0;
    padding: 24px 28px 8px;
  }
  .workflow-settings-drawer .ant-drawer-body {
    padding: 12px 28px 28px;
  }
  .workflow-settings-drawer .ant-drawer-footer {
    border: 0;
    padding: 16px 28px;
  }
  .workflow-settings-drawer .ant-btn-primary {
    background: #7371e6;
  }
  .workflow-settings-drawer .ant-tabs-ink-bar {
    background: #7371e6;
  }
</style>
