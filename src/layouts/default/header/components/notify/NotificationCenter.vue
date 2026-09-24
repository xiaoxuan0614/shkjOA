<template>
  <a-drawer v-model:open="open" title="站内通知" :width="560" :body-style="{ padding: '20px', maxWidth: '100vw' }">
    <div class="notification-tools">
      <a-radio-group v-model:value="filter" @change="search">
        <a-radio-button value="unread">未读</a-radio-button>
        <a-radio-button value="all">全部</a-radio-button>
      </a-radio-group>
      <a-button :loading="readingAll" :disabled="!unread" @click="readAll">全部已读</a-button>
      <a-button :loading="loading" @click="refresh">刷新</a-button>
    </div>
    <a-input-search v-model:value="keyword" placeholder="搜索通知标题" allow-clear @search="search" />
    <a-alert v-if="error" class="notification-error" type="error" :message="error" show-icon>
      <template #action><a-button size="small" @click="refresh">重试</a-button></template>
    </a-alert>
    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !error && !records.length" description="暂无通知" />
      <div class="notification-list">
        <button v-for="item in records" :key="item.id" type="button" class="notification-item" @click="showDetail(item)">
          <div class="notification-title">
            <span v-if="Number(item.readFlag) !== 1" class="notification-dot" aria-label="未读"></span>
            <a-tag v-if="item.izTop === 1" color="blue">置顶</a-tag>
            <strong>{{ item.titile || '无标题通知' }}</strong>
          </div>
          <p>{{ summary(item) }}</p>
          <div class="notification-meta"
            ><span>{{ item.sender || '系统通知' }}</span
            ><time>{{ item.sendTime || '—' }}</time></div
          >
        </button>
      </div>
      <a-pagination v-if="total" v-model:current="page" :total="total" :page-size="10" :show-size-changer="false" @change="loadList" />
    </a-spin>
  </a-drawer>
  <a-modal v-model:open="detailOpen" title="通知详情" :footer="null" :width="700">
    <a-spin :spinning="detailLoading">
      <a-alert v-if="detailError" :message="detailError" type="error" show-icon />
      <template v-if="detail">
        <h3>{{ detail.titile || '无标题通知' }}</h3>
        <p class="notification-meta">{{ detail.sender || '系统通知' }} · {{ detail.sendTime || '—' }}</p>
        <!-- Sanitized at the rendering boundary using the shared HTML allowlist. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="notification-content" v-html="sanitizeHtml(detail.msgContent || '暂无通知正文')"></div>
        <a-alert v-if="readError" :message="readError" type="warning" show-icon />
        <a-button v-if="readError" @click="markRead">重试标记已读</a-button>
        <a-button v-if="businessTarget || todoTarget" type="primary" class="notification-business" @click="viewBusiness">查看相关业务</a-button>
      </template>
    </a-spin>
  </a-modal>
  <TodoActionHost ref="todoHost" @processed="refresh" />
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref } from 'vue';
  import { Modal } from 'ant-design-vue';
  import { useRouter } from 'vue-router';
  import { sanitizeHtml } from '/@/utils/security';
  import { useMessage } from '/@/hooks/web/useMessage';
  import TodoActionHost from '/@/views/todo/components/TodoActionHost.vue';
  import { notificationTodo } from './notificationTodo';
  import { notificationPage, notificationDetail, markNotificationRead, markAllNotificationsRead, type NotificationRecord } from './notification.api';

  const emit = defineEmits<{ (e: 'updated'): void }>();
  defineProps<{ unread: number }>();
  const router = useRouter();
  const { createMessage } = useMessage();
  const open = ref(false),
    filter = ref('unread'),
    keyword = ref(''),
    page = ref(1),
    total = ref(0);
  const records = ref<NotificationRecord[]>([]);
  const loading = ref(false),
    error = ref(''),
    readingAll = ref(false);
  const detailOpen = ref(false),
    detailLoading = ref(false),
    detailError = ref(''),
    readError = ref('');
  const detail = ref<NotificationRecord | null>(null);
  const todoHost = ref<InstanceType<typeof TodoActionHost>>();
  const todoTarget = computed(() => notificationTodo(detail.value));
  let listVersion = 0,
    detailVersion = 0;
  function summary(item: NotificationRecord) {
    const value = item.msgAbstract?.trim() || '';
    if (value && !value.startsWith('{')) return value;
    return (item.msgContent || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 140);
  }
  async function loadList() {
    const version = ++listVersion;
    loading.value = true;
    error.value = '';
    try {
      const data = await notificationPage({
        pageNo: page.value,
        pageSize: 10,
        readFlag: filter.value === 'unread' ? 0 : undefined,
        titile: keyword.value.trim() || undefined,
      });
      if (version !== listVersion) return;
      records.value = data.records || [];
      total.value = Number(data.total) || 0;
      if (!records.value.length && page.value > 1) {
        page.value--;
        await loadList();
      }
    } catch (e) {
      if (version === listVersion) {
        records.value = [];
        error.value = e instanceof Error ? e.message : '通知加载失败';
      }
    } finally {
      if (version === listVersion) loading.value = false;
    }
  }
  function search() {
    page.value = 1;
    void loadList();
  }
  function refresh() {
    emit('updated');
    if (open.value) void loadList();
  }
  function show() {
    open.value = true;
    search();
    emit('updated');
  }
  async function showDetail(item: NotificationRecord) {
    const version = ++detailVersion;
    detailOpen.value = true;
    detail.value = null;
    detailError.value = '';
    readError.value = '';
    detailLoading.value = true;
    try {
      const data = await notificationDetail(item.id);
      if (version !== detailVersion) return;
      if (!data) {
        detailError.value = '通知已撤回、删除或暂不可查看';
        return;
      }
      detail.value = { ...item, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value != null)) };
      if (Number(data.readFlag) !== 1) await markRead(version);
    } catch (e) {
      if (version === detailVersion) detailError.value = e instanceof Error ? e.message : '详情加载失败';
    } finally {
      if (version === detailVersion) detailLoading.value = false;
    }
  }
  async function markRead(version: unknown = detailVersion) {
    const currentVersion = typeof version === 'number' ? version : detailVersion;
    const anntId = detail.value?.anntId;
    if (!anntId) {
      readError.value = '通知缺少标识，无法标记已读';
      return;
    }
    try {
      await markNotificationRead(anntId);
      if (currentVersion !== detailVersion) return;
      if (detail.value) detail.value.readFlag = 1;
      readError.value = '';
      refresh();
    } catch {
      if (currentVersion === detailVersion) readError.value = '正文已加载，但标记已读失败，请重试';
    }
  }
  function readAll() {
    Modal.confirm({
      title: '将全部通知标记为已读？',
      content: '包括当前搜索条件之外及历史通知，此操作不会删除通知。',
      async onOk() {
        readingAll.value = true;
        try {
          await markAllNotificationsRead();
          page.value = 1;
          refresh();
        } catch (e) {
          createMessage.error(e instanceof Error ? e.message : '操作失败');
        } finally {
          readingAll.value = false;
        }
      },
    });
  }
  const businessTarget = computed(() => {
    const item = detail.value;
    if (!item) return '';
    // Only known local project routes; never execute arbitrary server-supplied component paths.
    try {
      const action = JSON.parse(item.msgAbstract || '{}');
      if (
        action.action === 'VIEW_REJECTED_APPLICATION' &&
        action.periodId &&
        ['PROJECT_DELAY', 'PROJECT_MATERIAL_APPLY', 'PROJECT_PLAN', 'PROJECT_CONTRACT', 'PROJECT_REWORK'].includes(action.businessType)
      ) {
        return '/project/detail/' + encodeURIComponent(String(action.periodId));
      }
    } catch {
      /* Ordinary text summary. */
    }
    if (item.openType === 'url' && /^\/project\/detail\/[a-zA-Z0-9_-]+$/.test(item.openPage || '')) return item.openPage!;
    return '';
  });
  async function viewBusiness() {
    if (todoTarget.value) {
      await todoHost.value?.openTodo(todoTarget.value);
      detailOpen.value = false;
      open.value = false;
      return;
    }
    const target = router.resolve(businessTarget.value);
    if (!target.matched.length || target.matched.some((route) => route.path.includes(':path'))) {
      createMessage.warning('当前账号没有对应页面权限');
      return;
    }
    await router.push(target.fullPath);
    detailOpen.value = false;
    open.value = false;
  }
  onBeforeUnmount(() => {
    listVersion++;
    detailVersion++;
  });
  defineExpose({
    show,
    refreshList: () => {
      if (open.value) void loadList();
    },
  });
</script>

<style scoped lang="less">
  .notification-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }
  .notification-error {
    margin-top: 16px;
  }
  .notification-list {
    margin: 16px 0;
  }
  .notification-item {
    display: block;
    width: 100%;
    padding: 16px 4px;
    border: 0;
    border-bottom: 1px solid var(--border-color-base, #eee);
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .notification-item:hover {
    background: rgba(16, 158, 255, 0.05);
  }
  .notification-item:focus-visible {
    outline: 2px solid #109eff;
  }
  .notification-title {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-wrap: anywhere;
  }
  .notification-dot {
    flex: 0 0 7px;
    height: 7px;
    border-radius: 50%;
    background: #109eff;
  }
  .notification-item p {
    margin: 8px 0;
    color: #687781;
    overflow-wrap: anywhere;
  }
  .notification-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    color: #687781;
    font-size: 12px;
  }
  .notification-content {
    padding: 16px 0;
    overflow-wrap: anywhere;
    overflow-x: auto;
    :deep(img) {
      max-width: 100%;
      height: auto;
    }
  }
  .notification-business {
    margin-top: 20px;
  }
</style>
