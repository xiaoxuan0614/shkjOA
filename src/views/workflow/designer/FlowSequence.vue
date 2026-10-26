<template>
  <div class="flow-sequence">
    <AddNode :disabled="readonly" @add="(kind) => insert(0, kind)" />
    <template v-for="entry in entries" :key="entry.key">
      <section v-if="entry.group" class="approval-summary">
        <div class="summary-heading"><strong>动态审批组</strong><span>{{ entry.group.nodes.length }} 个节点</span></div>
        <p>依次审批 · 按各节点条件执行</p>
        <p class="summary-note">审批人员来自表单字段；折叠不改变流程。</p>
        <button class="summary-toggle" :aria-expanded="expanded.has(entry.group.id)" @click="toggleGroup(entry.group.id)">{{ expanded.has(entry.group.id) ? '收起节点' : '展开查看节点与规则' }}<UpOutlined v-if="expanded.has(entry.group.id)" /><DownOutlined v-else /></button>
      </section>
      <template v-for="node in entry.node ? [entry.node] : []" :key="node.id">
      <template v-if="node.branches">
        <section class="approval-summary branch-summary">
          <div class="summary-heading"><strong>{{ node.name || '分支组' }}</strong><span>{{ node.branches.length }} 个分支</span></div>
          <p>{{ node.kind === 'PARALLEL' ? '并行执行' : node.kind === 'CONDITION' ? '按条件选择分支' : '按顺序执行' }}</p>
          <button class="summary-toggle" :aria-expanded="!collapsedBranches.has(node.id)" @click="toggleBranch(node.id)">{{ collapsedBranches.has(node.id) ? '展开分支' : '收起分支' }}<DownOutlined v-if="collapsedBranches.has(node.id)" /><UpOutlined v-else /></button>
        </section>
        <template v-if="!collapsedBranches.has(node.id)">
        <div class="branch-group">
          <button v-if="['CONDITION', 'PARALLEL'].includes(node.kind)" class="add-branch" :disabled="readonly" @click="addBranch(node)">{{
            node.kind === 'CONDITION' ? '添加条件' : '添加并行分支'
          }}</button>
          <div class="branch-lanes">
            <div v-for="(lane, laneIndex) in node.branches" :key="lane.id" class="branch-lane">
              <div class="lane-line"></div>
              <article class="branch-card" :class="{ selected: selected === lane.id }">
                <button class="branch-select" @click="emit('select', node, lane)"
                  ><strong>{{ lane.name }}</strong
                  ><span>{{
                    lane.fallback
                      ? '不满足其他条件走此流程'
                      : node.kind === 'PARALLEL'
                        ? '与其他分支同时执行'
                        : ['SEQUENCE', 'SUBPROCESS'].includes(node.kind)
                          ? '按顺序执行'
                          : conditionSummary(lane)
                  }}</span></button
                >
                <button
                  v-if="!readonly && node.branches.length > 2 && !lane.fallback"
                  class="delete-lane"
                  aria-label="删除分支"
                  @click="removeBranch(node, laneIndex)"
                  ><CloseOutlined
                /></button>
              </article>
              <FlowSequence
                v-model:nodes="lane.children"
                :readonly="readonly"
                :selected="selected"
                @select="(n, b) => emit('select', n, b)"
                @changed="emit('changed')"
              />
              <div class="lane-tail"></div>
            </div>
          </div>
          <button v-if="!readonly" class="remove-group" aria-label="删除整个分支组" @click="remove(entry.index)"><DeleteOutlined /></button>
        </div>
        </template>
      </template>
      <article v-else class="canvas-node" :class="[node.kind.toLowerCase(), { selected: selected === node.id }]">
        <button class="node-select" @click="emit('select', node)">
          <strong
            ><span>{{ node.name || '未命名节点' }}</span
            ><component :is="icons[node.kind]"
          /></strong>
          <span class="node-description">{{ summary(node) }}<RightOutlined /></span>
        </button>
        <button v-if="!readonly" class="delete-node" :aria-label="`删除${node.name}`" @click="remove(entry.index)"><CloseOutlined /></button>
      </article>
      <AddNode :disabled="readonly" @add="(kind) => insert(entry.index + 1, kind)" />
      </template>
      <AddNode v-if="entry.group && !expanded.has(entry.group.id)" :disabled="readonly" @add="(kind) => insert(entry.index + entry.group!.nodes.length, kind)" />
    </template>
  </div>
</template>
<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { canvasEntries } from './presentation';
  import { relatedDepartmentSummary } from './relatedDepartment';
  import { Modal } from 'ant-design-vue';
  import {
    UserOutlined,
    SendOutlined,
    NotificationOutlined,
    ProfileOutlined,
    RightOutlined,
    CloseOutlined,
    DeleteOutlined,
    DownOutlined,
    UpOutlined,
  } from '@ant-design/icons-vue';
  import AddNode from './AddNode.vue';
  import { createDesignNode, branch } from './graph';
  import type { DesignNode, DesignBranch, NodeKind } from './graph';
  const props = defineProps<{ readonly?: boolean; selected?: string }>();
  const nodes = defineModel<DesignNode[]>('nodes', { required: true });
  const expanded = ref(new Set<string>());
  const collapsedBranches = ref(new Set<string>());
  const entries = computed(() => canvasEntries(nodes.value, expanded.value));
  function toggleGroup(id: string) { const next = new Set(expanded.value); next.has(id) ? next.delete(id) : next.add(id); expanded.value = next; }
  function toggleBranch(id: string) { const next = new Set(collapsedBranches.value); next.has(id) ? next.delete(id) : next.add(id); collapsedBranches.value = next; }
  const emit = defineEmits<{ (e: 'select', node: DesignNode, lane?: DesignBranch): void; (e: 'changed'): void }>();
  const icons = {
    SEQUENCE: ProfileOutlined,
    SUBPROCESS: ProfileOutlined,
    CONDITION: ProfileOutlined,
    PARALLEL: ProfileOutlined,
    APPROVAL: UserOutlined,
    CC: SendOutlined,
    NOTICE: NotificationOutlined,
    TASK: ProfileOutlined,
  };
  function insert(index: number, kind: NodeKind) {
    if (props.readonly) return;

    nodes.value.splice(index, 0, createDesignNode(kind));
    emit('changed');
  }
  function remove(index: number) {
    Modal.confirm({
      title: '删除此节点？',
      content: nodes.value[index].branches ? '分支组及其中的节点将一起删除。' : '删除后，前后节点会自动连接。',
      okText: '删除',
      cancelText: '取消',
      onOk: () => {
        nodes.value.splice(index, 1);
        emit('changed');
      },
    });
  }
  function removeBranch(n: DesignNode, i: number) {
    Modal.confirm({
      title: '删除此分支及内部节点？',
      okText: '删除',
      cancelText: '取消',
      onOk: () => {
        n.branches!.splice(i, 1);
        emit('changed');
      },
    });
  }
  function addBranch(n: DesignNode) {
    const lanes = n.branches!;
    const b = branch(`${n.kind === 'CONDITION' ? '条件' : '分支'}${lanes.length + 1}`);
    lanes.splice(n.kind === 'CONDITION' ? lanes.length - 1 : lanes.length, 0, b);
    emit('changed');
  }
  function conditionSummary(b: DesignBranch) {
    const count = b.groups.flat().filter((r) => r.field && r.value !== '').length;
    return count ? `已设置 ${count} 个条件` : b.predicate ? '已配置递归条件' : '请设置条件';
  }
  function summary(n: DesignNode) {
    if (n.config.source === 'relatedDepartment') return relatedDepartmentSummary(n);
    if (n.kind === 'APPROVAL') {
      const a = n.approval!;
      const count = (a.userIds?.length || 0) + (a.roleIds?.length || 0) + (a.approverRules?.length || 0);
      return count ? '已设置审批人员' : '请设置审批人';
    }
    if (n.kind === 'TASK') return n.config.task || '请设置任务';
    return n.config.users?.length ? `已选择 ${n.config.users.length} 人` : n.kind === 'CC' ? '设置抄送人' : '设置通知人';
  }
</script>
<style scoped>
  .approval-summary { width:280px; padding:16px; border:1px solid #dcdee7; border-radius:4px; background:#fff; color:#424659; box-sizing:border-box; }
  .summary-heading { display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
  .summary-heading strong { font-size:16px; overflow-wrap:anywhere; }
  .summary-heading span { flex-shrink:0; color:#545b6c; font-size:13px; }
  .approval-summary p { margin:10px 0 0; font-size:14px; line-height:1.6; }
  .approval-summary .summary-note { color:#545b6c; font-size:13px; }
  .summary-toggle { display:flex; justify-content:space-between; align-items:center; gap:12px; width:100%; min-height:40px; margin-top:12px; padding:0; border:0; background:transparent; color:#424659; cursor:pointer; text-align:left; }
  .branch-summary { margin-bottom:12px; }
  .flow-sequence {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: max-content;
    min-width: 280px;
  }
  .canvas-node,
  .branch-card {
    position: relative;
    width: 200px;
    background: white;
    border-radius: 2px;
    box-shadow: 0 2px 8px #26334d08;
    text-align: left;
  }
  .node-select,
  .branch-select {
    display: block;
    border: 0;
    padding: 0;
    background: transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
    color: #424659;
  }
  .node-select strong {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    color: white;
    font-weight: 500;
    background: linear-gradient(100deg, #4556e9, #682ce8);
  }
  .cc strong {
    background: linear-gradient(100deg, #eb795c, #efaf49);
  }
  .notice strong {
    background: linear-gradient(100deg, #3e8acc, #58b7dd);
  }
  .task strong {
    background: linear-gradient(100deg, #72be80, #b3d151);
  }
  .node-description {
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    font-size: 12px;
    gap: 8px;
    overflow-wrap: anywhere;
  }
  .node-description > span {
    color: #989da9;
  }
  .delete-node,
  .delete-lane {
    position: absolute;
    right: 5px;
    top: 3px;
    width: 24px;
    height: 24px;
    border: 0;
    background: white;
    color: #626776;
    opacity: 0;
    cursor: pointer;
  }
  .canvas-node:hover .delete-node,
  .canvas-node:focus-within .delete-node,
  .branch-card:hover .delete-lane,
  .branch-card:focus-within .delete-lane {
    opacity: 1;
  }
  .selected {
    outline: 2px solid #7875ee;
    outline-offset: 3px;
  }
  .branch-group {
    position: relative;
    padding-top: 20px;
  }
  .branch-lanes {
    display: flex;
    align-items: stretch;
  }
  .branch-lane {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 30px;
    min-width: 280px;
    border-top: 1px solid #dcdee7;
    border-bottom: 1px solid #dcdee7;
  }
  .branch-lane:first-child:before,
  .branch-lane:last-child:before {
    content: '';
    position: absolute;
    top: -1px;
    width: 50%;
    height: 1px;
    background: #f7f8fc;
  }
  .branch-lane:first-child:before {
    left: 0;
  }
  .branch-lane:last-child:before {
    right: 0;
  }
  .branch-lane:first-child:after,
  .branch-lane:last-child:after {
    content: '';
    position: absolute;
    bottom: -1px;
    width: 50%;
    height: 1px;
    background: #f7f8fc;
  }
  .branch-lane:first-child:after {
    left: 0;
  }
  .branch-lane:last-child:after {
    right: 0;
  }
  .lane-line {
    height: 42px;
    width: 1px;
    background: #dcdee7;
  }
  .lane-tail {
    flex: 1;
    min-height: 24px;
    width: 1px;
    background: #dcdee7;
  }
  .branch-select {
    padding: 14px;
    min-height: 90px;
  }
  .branch-select strong {
    display: block;
    color: #519a78;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 14px;
  }
  .branch-select > span {
    font-size: 12px;
    color: #606773;
  }
  .add-branch {
    position: absolute;
    left: 50%;
    top: 5px;
    transform: translateX(-50%);
    z-index: 2;
    background: #fff;
    border: 1px solid #e4e5ed;
    border-radius: 15px;
    padding: 4px 12px;
    color: #6865c2;
    font-size: 12px;
    cursor: pointer;
  }
  .remove-group {
    position: absolute;
    bottom: -12px;
    right: 5px;
    border: 0;
    background: #fff;
    color: #a3a6b0;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid #6266dc !important;
    outline-offset: 3px;
  }
</style>
