<template>
  <a-drawer
    v-model:open="open"
    title="站内通知"
    :width="560"
    :body-style="{ padding: '20px', maxWidth: '100vw', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }"
    :footer-style="{ padding: '12px 20px' }"
  >
    <div class="notification-filters">
      <div class="notification-tools">
        <a-radio-group v-model:value="filter" @change="search">
          <a-radio-button value="unread">未读</a-radio-button>
          <a-radio-button value="all">全部</a-radio-button>
        </a-radio-group>
        <a-button :loading="readingAll" :disabled="!unread" @click="readAll">全部已读</a-button>
        <a-button :loading="loading" @click="refresh">刷新</a-button>
      </div>
      <a-input-search v-model:value="keyword" placeholder="搜索通知标题" allow-clear @search="search" />
    </div>
    <div class="notification-scroll" role="region" aria-label="通知列表" tabindex="0">
      <a-alert v-if="error" class="notification-error" type="error" :message="error" show-icon>
        <template #action><a-button size="small" @click="refresh">重试</a-button></template>
      </a-alert>
      <a-spin :spinning="loading">
        <a-empty v-if="!loading && !error && !records.length" :description="total ? '当前页暂无通知，请刷新或切换页码' : '暂无通知'" />
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
      </a-spin>
    </div>
    <template #footer>
      <a-pagination v-model:current="page" :total="total" :page-size="10" :show-size-changer="false" :disabled="loading" @change="loadList" />
    </template>
  </a-drawer>
  <a-modal v-model:open="detailOpen" title="通知详情" :footer="null" :width="700">
    <a-spin :spinning="detailLoading">
      <a-alert v-if="detailError" :message="detailError" type="error" show-icon />
      <template v-if="detail">
        <header class="notification-detail-header">
          <h3>{{ detail.titile || '无标题通知' }}</h3>
          <div class="notification-meta">
            <span>来源：{{ detail.sender || '系统通知' }}</span>
            <time>{{ detail.sendTime || '—' }}</time>
          </div>
        </header>
        <!-- Sanitized at the rendering boundary using the shared HTML allowlist. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="notification-content" :class="{ 'notification-content-plain': isPlainContent }" v-html="detailContent"></div>
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
  import { notificationPage, markNotificationRead, markAllNotificationsRead, type NotificationRecord } from './notification.api';

  const emit = defineEmits<{ (e: 'updated'): void; (e: 'count', count: number): void; (e: 'read'): void }>();
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
  const detailContent = computed(() => sanitizeHtml(detail.value?.msgContent?.trim() || '暂无通知正文'));
  // Plain text retains line breaks; rich text uses its own paragraph/br structure.
  const isPlainContent = computed(() => !/<\/?[a-z][^>]*>/i.test(detailContent.value));
  const todoHost = ref<InstanceType<typeof TodoActionHost>>();
  const todoTarget = computed(() => notificationTodo(detail.value));
  let listVersion = 0,
    detailVersion = 0;
  let disposed = false;
  const pendingReads = new Set<string>();
  const completedReads = new Set<string>();
  function summary(item: NotificationRecord) {
    return item.msgSummary?.trim() || '';
  }
  async function loadList() {
    const version = ++listVersion;
    const unfilteredUnread = filter.value === 'unread' && !keyword.value.trim();
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
      if (unfilteredUnread) emit('count', total.value);
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
    if (open.value) return;
    open.value = true;
    filter.value = 'unread';
    keyword.value = '';
    search();
  }
  async function showDetail(item: NotificationRecord) {
    const version = ++detailVersion;
    detailOpen.value = true;
    detail.value = { ...item };
    detailError.value = '';
    readError.value = '';
    if (completedReads.has(item.anntId)) detail.value.readFlag = 1;
    if (Number(detail.value.readFlag) !== 1) await markRead(version);
  }
  async function markRead(version: unknown = detailVersion) {
    const currentVersion = typeof version === 'number' ? version : detailVersion;
    const anntId = detail.value?.anntId;
    if (!anntId) {
      readError.value = '通知缺少标识，无法标记已读';
      return;
    }
    if (Number(detail.value?.readFlag) === 1 || pendingReads.has(anntId) || completedReads.has(anntId)) return;
    pendingReads.add(anntId);
    try {
      await markNotificationRead(anntId);
      if (disposed) return;
      completedReads.add(anntId);
      // Ignore list responses started before this successful local mutation.
      listVersion++;
      loading.value = false;
      const matching = records.value.filter((record) => record.anntId === anntId);
      matching.forEach((record) => (record.readFlag = 1));
      if (filter.value === 'unread') {
        records.value = records.value.filter((record) => record.anntId !== anntId);
        total.value = Math.max(0, total.value - matching.length);
      }
      if (detail.value?.anntId === anntId) {
        detail.value.readFlag = 1;
        readError.value = '';
      }
      emit('read');
    } catch {
      if (currentVersion === detailVersion) readError.value = '正文已加载，但标记已读失败，请重试';
    } finally {
      pendingReads.delete(anntId);
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
    disposed = true;
    listVersion++;
    detailVersion++;
  });
  defineExpose({
    show,
    refreshList: () => {
      if (open.value) void loadList();
      return open.value && filter.value === 'unread' && !keyword.value.trim();
    },
  });
</script>

<style scoped lang="less">
  .notification-filters {
    flex: 0 0 auto;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color-base, #eee);
  }
  .notification-scroll {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    padding: 0 4px;
  }
  .notification-scroll:focus-visible {
    outline: 2px solid #109eff;
    outline-offset: -2px;
  }
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
    line-height: 1.65;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .notification-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    color: #687781;
    font-size: 12px;
  }
  .notification-detail-header {
    padding: 8px 0 20px;
    border-bottom: 1px solid var(--border-color-base, #e5e7eb);
    h3 {
      margin: 0 0 12px;
      color: inherit;
      font-size: 20px;
      font-weight: 600;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
  }
  .notification-content {
    margin: 20px 0;
    max-height: 55vh;
    padding: 0 4px;
    font-size: 14px;
    line-height: 1.75;
    overflow-wrap: anywhere;
    overflow: auto;
    :deep(p) {
      margin: 0 0 12px;
    }
    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4),
    :deep(h5),
    :deep(h6) {
      margin: 20px 0 12px;
      color: inherit;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.5;
    }
    :deep(ul),
    :deep(ol) {
      margin: 12px 0;
      padding-left: 24px;
    }
    :deep(ul) {
      list-style: disc;
    }
    :deep(ol) {
      list-style: decimal;
    }
    :deep(li) {
      margin: 4px 0;
    }
    :deep(blockquote) {
      margin: 12px 0;
      padding: 8px 16px;
      border-left: 3px solid var(--border-color-base, #d9d9d9);
      background: rgba(128, 128, 128, 0.06);
    }
    :deep(table) {
      width: 100%;
      margin: 12px 0;
      border-collapse: collapse;
    }
    :deep(th),
    :deep(td) {
      padding: 8px 12px;
      border: 1px solid var(--border-color-base, #d9d9d9);
      text-align: left;
    }
    :deep(th) {
      background: rgba(128, 128, 128, 0.08);
    }
    :deep(pre) {
      padding: 12px;
      background: rgba(128, 128, 128, 0.06);
      white-space: pre-wrap;
    }
    :deep(a) {
      text-decoration: underline;
    }
    :deep(img) {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }
  }
  .notification-content-plain {
    white-space: pre-wrap;
  }
  .notification-business {
    margin-top: 20px;
  }
</style>
