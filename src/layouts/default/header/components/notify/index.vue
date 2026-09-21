<template>
  <div :class="prefixCls">
    <button
      v-if="notificationsEnabled"
      class="notification-bell"
      type="button"
      :aria-label="countError ? '通知未读数加载失败，点击重试' : '站内通知，未读 ' + messageCount + ' 条'"
      @click="center?.show()"
    >
      <Badge :count="messageCount" :overflow-count="99" :offset="[2, 0]"><BellOutlined /></Badge>
      <span v-if="countError" class="notification-warning" title="未读数加载失败">!</span>
    </button>
    <NotificationCenter v-if="notificationsEnabled" ref="center" :unread="messageCount" @updated="loadCount" />
    <ChangePasswordModal @register="changePwdModal" />
  </div>
</template>
<script lang="ts">
  export default { name: 'HeaderNotification' };
</script>
<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue';
  import { Badge } from 'ant-design-vue';
  import { BellOutlined } from '@ant-design/icons-vue';
  import md5 from 'crypto-js/md5';
  import { useDesign } from '/@/hooks/web/useDesign';
  import { useGlobSetting } from '/@/hooks/setting';
  import { useUserStore } from '/@/store/modules/user';
  import { connectWebSocket, onWebSocket, offWebSocket } from '/@/hooks/web/useWebSocket';
  import { getToken } from '/@/utils/auth';
  import { useModal } from '/@/components/Modal';
  import { defHttp } from '/@/utils/http/axios';
  import ChangePasswordModal from './ChangePasswordModal.vue';
  import NotificationCenter from './NotificationCenter.vue';
  import { notificationPage } from './notification.api';

  const { prefixCls } = useDesign('header-notify');
  // 临时暂停站内通知；恢复时同时开启入口、查询及自动刷新。
  const notificationsEnabled = false;
  const glob = useGlobSetting();
  const userStore = useUserStore();
  const center = ref<InstanceType<typeof NotificationCenter>>();
  const messageCount = ref(0),
    countError = ref(false);
  const [changePwdModal, { openModal: openPwdModal }] = useModal();
  let countVersion = 0;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  async function loadCount() {
    if (!notificationsEnabled) return;
    const version = ++countVersion;
    try {
      const data = await notificationPage({ pageNo: 1, pageSize: 1, readFlag: 0 });
      if (version !== countVersion) return;
      messageCount.value = Number(data.total) || 0;
      countError.value = false;
    } catch {
      if (version === countVersion) countError.value = true;
    }
  }
  function refresh() {
    if (!notificationsEnabled) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void loadCount();
      center.value?.refreshList();
    }, 300);
  }
  function onMessage(data: any) {
    if (data.cmd === 'topic' || data.cmd === 'user') refresh();
  }
  function onVisibility() {
    if (document.visibilityState === 'visible') refresh();
  }
  onMounted(() => {
    if (notificationsEnabled) {
      void loadCount();
      const token = getToken();
      const userId = userStore.getUserInfo.id;
      if (token && userId && glob.domainUrl) {
        const url = glob.domainUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        connectWebSocket(url + '/websocket/' + userId + '_' + md5(String(token)));
        onWebSocket(onMessage);
      }
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', onVisibility);
    }
    // Preserve the existing forced default-password change prompt.
    defHttp
      .get({ url: '/sys/user/verifyIzDefaultPwd' }, { isTransformResponse: false })
      .then((res) => {
        if (res.success && typeof res.message === 'string' && res.message.includes('yes')) {
          openPwdModal(true, { oldPassword: res.message.split('_')[1] });
        }
      })
      .catch(() => {
        /* Request layer reports authentication/network errors. */
      });
  });
  onBeforeUnmount(() => {
    countVersion++;
    clearTimeout(refreshTimer);
    offWebSocket(onMessage);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', onVisibility);
  });
</script>
<style scoped lang="less">
  .notification-bell {
    position: relative;
    display: inline-flex;
    align-items: center;
    border: 0;
    background: transparent;
    color: inherit;
    padding: 8px;
    cursor: pointer;
    font-size: 18px;
  }
  .notification-bell:focus-visible {
    outline: 2px solid #109eff;
    outline-offset: 2px;
  }
  .notification-warning {
    position: absolute;
    top: 0;
    right: 0;
    color: #d46b08;
    font-size: 12px;
  }
</style>
