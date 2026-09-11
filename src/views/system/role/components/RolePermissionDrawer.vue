<template>
  <BasicDrawer v-bind="$attrs" @register="registerDrawer" width="720px" destroyOnClose showFooter>
    <template #title>
      角色权限配置
      <a-dropdown>
        <a-button class="more-icon">
          更多操作
          <Icon icon="ant-design:down-outlined" size="14px" class="more-icon-arrow" />
        </a-button>
        <template #overlay>
          <a-menu @click="treeMenuClick">
            <a-menu-item key="checkAll">选择当前端全部权限</a-menu-item>
            <a-menu-item key="cancelCheck">取消当前端选择</a-menu-item>
            <div class="line"></div>
            <a-menu-item key="openAll">展开当前端全部节点</a-menu-item>
            <a-menu-item key="closeAll">折叠当前端全部节点</a-menu-item>
            <div class="line"></div>
            <a-menu-item key="relation">层级关联</a-menu-item>
            <a-menu-item key="standAlone">层级独立</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </template>

    <a-tabs v-model:activeKey="activeClient" class="permission-tabs">
      <a-tab-pane v-for="client in clientTabs" :key="client.key">
        <template #tab>{{ client.label }}（{{ permissionState[client.key].checkedKeys.length }}）</template>

        <a-alert
          v-if="permissionState[client.key].error"
          type="error"
          show-icon
          :message="`${client.label}加载失败`"
          :description="permissionState[client.key].error"
        />
        <BasicTree
          v-else
          checkable
          :treeData="permissionState[client.key].treeData"
          :checkedKeys="permissionState[client.key].checkedKeys"
          :expandedKeys="permissionState[client.key].expandedKeys"
          :selectedKeys="permissionState[client.key].selectedKeys"
          :clickRowToExpand="false"
          :checkStrictly="checkStrictly"
          :title="`${client.label}所拥有的权限`"
          @check="(keys, event) => onCheck(client.key, keys, event)"
        >
          <template #title="node">
            <span class="permission-node">
              <span class="permission-node__label">{{ node.slotTitle }}</span>
              <a-button
                v-if="node.ruleFlag"
                type="link"
                size="small"
                class="data-rule-button"
                :aria-label="`配置${node.slotTitle}的数据规则`"
                @click.stop="openNodeDataRule(client.key, node.key)"
              >
                配置数据规则
              </a-button>
            </span>
          </template>
        </BasicTree>
      </a-tab-pane>
    </a-tabs>

    <template #footer>
      <a-button @click="closeDrawer">取消</a-button>
      <a-button @click="handleSubmit(false)" type="primary" :loading="loading" ghost style="margin-right: 0.8rem">仅保存</a-button>
      <a-button @click="handleSubmit(true)" type="primary" :loading="loading">保存并关闭</a-button>
    </template>
    <RoleDataRuleDrawer @register="registerDataRuleDrawer" />
  </BasicDrawer>
</template>

<script lang="ts" setup>
  import { reactive, ref, unref } from 'vue';
  import { BasicDrawer, useDrawer, useDrawerInner } from '/@/components/Drawer';
  import { BasicTree, TreeItem } from '/@/components/Tree';
  import { Icon } from '/@/components/Icon';
  import { useI18n } from '/@/hooks/web/useI18n';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { ROLE_AUTH_CONFIG_KEY } from '/@/enums/cacheEnum';
  import RoleDataRuleDrawer from './RoleDataRuleDrawer.vue';
  import {
    queryAppTreeList,
    queryRoleAppPermission,
    queryRolePermission,
    queryTreeListForRole,
    saveRoleAppPermission,
    saveRolePermission,
  } from '../role.api';

  type ClientKey = 'PC' | 'APP';

  interface ClientPermissionState {
    treeData: TreeItem[];
    allTreeKeys: string[];
    checkedKeys: string[];
    defaultCheckedKeys: string[];
    expandedKeys: string[];
    selectedKeys: string[];
    loaded: boolean;
    dirty: boolean;
    error: string;
  }

  defineEmits(['register']);
  const { t } = useI18n();
  const { createMessage } = useMessage();
  const clientTabs: Array<{ key: ClientKey; label: string }> = [
    { key: 'PC', label: 'PC端权限' },
    { key: 'APP', label: '移动端权限' },
  ];

  const createClientState = (): ClientPermissionState => ({
    treeData: [],
    allTreeKeys: [],
    checkedKeys: [],
    defaultCheckedKeys: [],
    expandedKeys: [],
    selectedKeys: [],
    loaded: false,
    dirty: false,
    error: '',
  });

  const permissionState = reactive<Record<ClientKey, ClientPermissionState>>({
    PC: createClientState(),
    APP: createClientState(),
  });
  const activeClient = ref<ClientKey>('PC');
  const roleId = ref('');
  const loading = ref(false);
  const checkStrictly = ref(false);
  const [registerDataRuleDrawer, { openDrawer: openDataRuleDrawer }] = useDrawer();

  const [registerDrawer, { setDrawerProps, closeDrawer }] = useDrawerInner(async (data) => {
    reset();
    setDrawerProps({ confirmLoading: false, loading: true });
    roleId.value = data.roleId;

    await Promise.all([loadClientPermission('PC'), loadClientPermission('APP')]);
    applySavedTreePreference();
    setDrawerProps({ loading: false });
  });

  async function loadClientPermission(client: ClientKey) {
    const state = permissionState[client];
    try {
      const [treeResult, checkedResult] = await Promise.all([
        client === 'PC' ? queryTreeListForRole() : queryAppTreeList(),
        client === 'PC'
          ? queryRolePermission({ roleId: unref(roleId) })
          : queryRoleAppPermission({ roleId: unref(roleId) }),
      ]);
      const sourceTree = client === 'PC' ? treeResult?.treeList || [] : treeResult || [];
      state.treeData = normalizeTree(sourceTree);
      state.allTreeKeys = client === 'PC' && treeResult?.ids?.length ? treeResult.ids : collectTreeKeys(state.treeData);
      state.checkedKeys = Array.isArray(checkedResult) ? checkedResult : [];
      state.defaultCheckedKeys = [...state.checkedKeys];
      state.expandedKeys = [...state.allTreeKeys];
      state.loaded = true;
      state.error = '';
    } catch (error: any) {
      state.loaded = false;
      state.error = error?.message || error?.msg || '请检查权限接口或网络连接后重试。';
    }
  }

  function normalizeTree(data: any[]): TreeItem[] {
    return (data || []).map((item) => {
      const rawTitle = item.slotTitle || item.title || item.name || '未命名权限';
      const slotTitle = translateTitle(rawTitle);
      return {
        ...item,
        key: String(item.key || item.id),
        value: String(item.value || item.key || item.id),
        title: slotTitle,
        slotTitle,
        scopedSlots: { ...(item.scopedSlots || {}), title: 'title' },
        children: normalizeTree(item.children || []),
      };
    });
  }

  function translateTitle(title: string) {
    if (title.includes("t('") && t) {
      try {
        return new Function('t', `return ${title}`)(t);
      } catch (error) {
        console.warn('角色权限菜单国际化处理失败:', error);
      }
    }
    return title;
  }

  function collectTreeKeys(treeData: TreeItem[]): string[] {
    return treeData.flatMap((item: any) => [String(item.key), ...collectTreeKeys(item.children || [])]);
  }

  function onCheck(client: ClientKey, keys, event) {
    const state = permissionState[client];
    if (checkStrictly.value) {
      state.checkedKeys = keys?.checked ? keys.checked : keys;
    } else {
      const nodeKeys = getNodeAllKey(event.node, 'children', 'key');
      state.checkedKeys = event.checked
        ? [...new Set([...state.checkedKeys, ...nodeKeys])]
        : removeMatchingItems(state.checkedKeys, nodeKeys);
    }
    state.dirty = true;
  }

  function removeMatchingItems(source: string[], targets: string[]) {
    const targetSet = new Set(targets);
    return source.filter((item) => !targetSet.has(item));
  }

  function getNodeAllKey(node: any, childrenField: string, keyField: string) {
    const result: string[] = [String(node[keyField])];
    const recursion = (data: any[]) => {
      data.forEach((item) => {
        result.push(String(item[keyField]));
        if (item[childrenField]?.length) recursion(item[childrenField]);
      });
    };
    if (node[childrenField]?.length) recursion(node[childrenField]);
    return result;
  }

  function openNodeDataRule(client: ClientKey, nodeKey: string | number) {
    const functionId = String(nodeKey || '');
    if (!functionId) return;
    const state = permissionState[client];
    state.selectedKeys = [functionId];
    openDataRuleDrawer(true, {
      functionId,
      roleId: unref(roleId),
      clientType: client,
    });
  }

  function reset() {
    activeClient.value = 'PC';
    roleId.value = '';
    checkStrictly.value = false;
    (Object.keys(permissionState) as ClientKey[]).forEach((client) => {
      Object.assign(permissionState[client], createClientState());
    });
  }

  async function handleSubmit(exit: boolean) {
    if (loading.value) return;
    const dirtyClients = (Object.keys(permissionState) as ClientKey[]).filter(
      (client) => permissionState[client].loaded && permissionState[client].dirty,
    );
    if (!dirtyClients.length) {
      createMessage.info('权限未发生变化');
      if (exit) closeDrawer();
      return;
    }

    loading.value = true;
    try {
      const results = await Promise.allSettled(dirtyClients.map((client) => saveClientPermission(client)));
      const failedClients = dirtyClients.filter((_, index) => results[index].status === 'rejected');
      if (failedClients.length) {
        createMessage.error(`${failedClients.map(getClientLabel).join('、')}保存失败，请检查后重试`);
        return;
      }
      createMessage.success('角色权限保存成功');
      if (exit) closeDrawer();
    } finally {
      loading.value = false;
    }
  }

  async function saveClientPermission(client: ClientKey) {
    const state = permissionState[client];
    const params = {
      roleId: unref(roleId),
      permissionIds: state.checkedKeys.join(','),
      lastpermissionIds: state.defaultCheckedKeys.join(','),
    };
    if (client === 'PC') {
      await saveRolePermission(params);
    } else {
      await saveRoleAppPermission(params);
    }
    const checkedResult =
      client === 'PC'
        ? await queryRolePermission({ roleId: unref(roleId) })
        : await queryRoleAppPermission({ roleId: unref(roleId) });
    state.checkedKeys = Array.isArray(checkedResult) ? checkedResult : [];
    state.defaultCheckedKeys = [...state.checkedKeys];
    state.dirty = false;
  }

  function getClientLabel(client: ClientKey) {
    return client === 'PC' ? 'PC端权限' : '移动端权限';
  }

  function treeMenuClick({ key }) {
    const state = permissionState[activeClient.value];
    if (!state.loaded) return;

    if (key === 'checkAll') {
      state.checkedKeys = [...state.allTreeKeys];
      state.dirty = true;
    } else if (key === 'cancelCheck') {
      state.checkedKeys = [];
      state.dirty = true;
    } else if (key === 'openAll') {
      state.expandedKeys = [...state.allTreeKeys];
      saveLocalOperation('expand', 'openAll');
    } else if (key === 'closeAll') {
      state.expandedKeys = [];
      saveLocalOperation('expand', 'closeAll');
    } else if (key === 'relation') {
      checkStrictly.value = false;
      saveLocalOperation('level', 'relation');
    } else {
      checkStrictly.value = true;
      saveLocalOperation('level', 'standAlone');
    }
  }

  function applySavedTreePreference() {
    const localData = localStorage.getItem(ROLE_AUTH_CONFIG_KEY);
    if (!localData) return;
    try {
      const config = JSON.parse(localData);
      checkStrictly.value = config.level === 'standAlone';
      if (config.expand === 'closeAll') {
        permissionState.PC.expandedKeys = [];
        permissionState.APP.expandedKeys = [];
      }
    } catch (error) {
      console.warn('读取角色授权操作偏好失败:', error);
    }
  }

  function saveLocalOperation(key: string, value: string) {
    const localData = localStorage.getItem(ROLE_AUTH_CONFIG_KEY);
    const config = localData ? JSON.parse(localData) : {};
    config[key] = value;
    localStorage.setItem(ROLE_AUTH_CONFIG_KEY, JSON.stringify(config));
  }
</script>

<style lang="less" scoped>
  .permission-tabs {
    min-height: 480px;
  }

  .jeecg-basic-tree {
    width: 100%;
  }

  .line {
    width: 100%;
    height: 1px;
    border-bottom: 1px solid #f0f0f0;
  }

  .more-icon {
    float: right;
    margin-right: 2px;
    cursor: pointer;
  }

  .more-icon-arrow {
    position: relative;
    top: 1px;
    right: 5px;
  }

  .permission-node {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
  }

  .permission-node__label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .data-rule-button {
    flex-shrink: 0;
    height: 24px;
    margin-left: auto;
    padding: 0 4px;
  }

  :deep(.jeecg-tree-header) {
    border-bottom: none;
  }
</style>
