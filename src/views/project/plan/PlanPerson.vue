<template>
  <div class="plan-person">
    <!-- 回显已选定的项目经理 / 销售负责人 -->
    <a-descriptions v-if="Object.keys(context).length" :column="2" size="small" bordered class="plan-person__context">
      <a-descriptions-item label="项目经理">{{ context.projectLeaderName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="销售负责人">{{ context.salesUserName || '—' }}</a-descriptions-item>
    </a-descriptions>

    <!-- 参与人员信息 -->
    <div class="plan-person__group">
      <div class="plan-person__group-title">
        <span>参与人员信息</span>
        <span class="plan-person__hint">选择人员后需发送邀约，对方同意后才计入参与人员</span>
        <a-button type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addPerson">添加</a-button>
      </div>
      <a-table
        :columns="personColumns"
        :data-source="personList"
        :row-key="(record) => record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'role'">
            <a-select v-model:value="record.role" placeholder="请选择角色" style="width: 100%" :options="roleOptions" :disabled="!editable" />
          </template>
          <template v-else-if="column.key === 'member'">
            <a-select
              v-model:value="record.memberId"
              showSearch
              allowClear
              option-filter-prop="label"
              :disabled="!editable"
              placeholder="请选择成员"
              style="width: 100%"
              :options="userOptions"
              @change="(v) => onMemberChange(record, v)"
            />
          </template>
          <template v-else-if="column.key === 'inviteStatus'">
            <a-tag :color="inviteStatusMeta[record.inviteStatus]?.color || 'default'">
              {{ inviteStatusMeta[record.inviteStatus]?.text || '待接受' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="editable && !record.memberId" type="link" danger size="small" @click="removePerson(record._key)">删除</a-button>
            <template v-else-if="editable && record.memberId">
              <a-button v-if="record.inviteStatus !== '1'" type="link" size="small" @click="sendInvite(record)">发送邀约</a-button>
              <a-button v-if="record.inviteStatus !== '1'" type="link" danger size="small" @click="removePerson(record._key)">删除</a-button>
            </template>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 外协配置 -->
    <div class="plan-person__group">
      <div class="plan-person__group-title">
        <span>外协配置</span>
        <a-button type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addOutsourcing">添加</a-button>
      </div>
      <a-table
        :columns="outsourcingColumns"
        :data-source="outsourcingList"
        :row-key="(record) => record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'unit'">
            <a-select
              v-model:value="record.unit"
              showSearch
              allowClear
              :disabled="!editable"
              placeholder="请选择外协单位"
              style="width: 100%"
              :options="outsourcingOptions"
              :filter-option="(input: string, option: any) => (option?.label || '').toLowerCase().includes(input.toLowerCase())"
            />
          </template>
          <template v-else-if="column.key === 'peopleNum'">
            <a-input-number v-model:value="record.peopleNum" :min="0" placeholder="人数" style="width: 100%" :disabled="!editable" />
          </template>
          <template v-else-if="column.key === 'hours'">
            <a-input-number v-model:value="record.hours" :min="0" placeholder="工时" style="width: 100%" :disabled="!editable" />
          </template>
          <template v-else-if="column.key === 'contact'">
            <a-input v-model:value="record.contact" placeholder="联系人" :disabled="!editable" />
          </template>
          <template v-else-if="column.key === 'phone'">
            <a-input v-model:value="record.phone" placeholder="联系方式" :disabled="!editable" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="editable" type="link" danger size="small" @click="removeOutsourcing(record._key)">删除</a-button>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, unref, onMounted } from 'vue';
  import { list as fetchOutsourcingList } from '../../resource/outsourcing/Outsourcing.api';
  import { loadUserOptions } from '/@/views/resource/userOptions';
  import { loadDictOptions } from '../Project.data';
  import { projectDetail } from '../Project.api';
  import { contractList } from '/@/views/payment/Payment.api';
  import { addInvitation } from './Invite.api';
  import { useMessage } from '/@/hooks/web/useMessage';

  const { createMessage } = useMessage();

  // 属性: editable 控制是否可编辑; periodId 用于回显项目经理/销售负责人
  const props = defineProps<{
    editable?: boolean;
    periodId?: string;
  }>();

  // 回显上下文(项目经理 + 销售负责人)
  const context = ref<Recordable>({});
  onMounted(async () => {
    // 回显项目经理/销售负责人
    if (props.periodId) {
      try {
        const data: any = await projectDetail({ periodId: props.periodId });
        context.value.projectLeaderName = data?.projectLeaderName || '';
        const res: any = await contractList({ periodId: props.periodId, pageNo: 1, pageSize: 1 });
        const c = (res?.records || res || [])[0] || {};
        context.value.salesUserName = c?.salesUserName || '';
      } catch {
        context.value = {};
      }
    }
    // 外协单位下拉(进入页面自动请求)
    try {
      const res: any = await fetchOutsourcingList({ pageNo: 1, pageSize: 1000 });
      const records = res?.records || res || [];
      outsourcingOptions.value = (records || []).map((o: any) => ({ label: o.unitName, value: o.unitName }));
    } catch {
      outsourcingOptions.value = [];
    }
    // 成员角色下拉(字典 member_role, 失败兜底硬编码)
    roleOptions.value = await loadDictOptions('member_role', memberRoleFallback);
    // 全量用户(成员选择)
    userOptions.value = (await loadUserOptions()) || [];
    // 邀请状态字典(invite_status)
    try {
      const items: any[] = (await loadDictOptions('invite_status')) || [];
      inviteStatusMeta.value = Object.fromEntries(items.map((i) => [String(i.value), { text: i.label, color: i.color || 'default' }]));
    } catch {
      inviteStatusMeta.value = inviteStatusFallback;
    }
  });

  // 成员用户下拉
  const userOptions = ref<{ label: string; value: string }[]>([]);

  // 角色下拉(兜底: 字典 member_role 加载失败时用)
  const memberRoleFallback = [
    { label: '项目负责人', value: '项目负责人' },
    { label: '现场负责人', value: '现场负责人' },
    { label: '技术负责人', value: '技术负责人' },
    { label: '施工人员', value: '施工人员' },
    { label: '安全员', value: '安全员' },
  ];
  const roleOptions = ref<{ label: string; value: string }[]>(memberRoleFallback);

  // 邀请状态字典(字典 invite_status: 0待接受 / 1已接收)
  const inviteStatusMeta = ref<Recordable>({});
  const inviteStatusFallback: Recordable = {
    '0': { text: '待接受', color: 'default' },
    '1': { text: '已接收', color: 'success' },
  };

  // 参与人员
  const personColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '角色', key: 'role', width: 150 },
    { title: '成员', key: 'member' },
    { title: '邀请状态', key: 'inviteStatus', width: 100 },
    { title: '操作', key: 'action', width: 140, align: 'center' },
  ];
  const personList = ref<any[]>([]);
  let personSeed = 0;

  // 外协配置
  const outsourcingColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '外协单位', key: 'unit' },
    { title: '人数', key: 'peopleNum', width: 100 },
    { title: '工时', key: 'hours', width: 100 },
    { title: '联系人', key: 'contact', width: 120 },
    { title: '联系方式', key: 'phone', width: 140 },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const outsourcingList = ref<any[]>([]);
  let outsourcingSeed = 0;

  // 暴露给父级
  defineExpose({
    getData() {
      return { personList: unref(personList), outsourcingList: unref(outsourcingList) };
    },
    setData(data: any) {
      personList.value = (data?.personList || []).map((item) => ({ ...item, _key: ++personSeed, memberId: item.memberId, memberName: item.memberName || item.member || '' }));
      outsourcingList.value = (data?.outsourcingList || []).map((item) => ({ ...item, _key: ++outsourcingSeed }));
    },
  });

  // 添加参与人员
  function addPerson() {
    personList.value.push({ _key: ++personSeed, role: undefined, memberId: undefined, memberName: '', inviteStatus: '0' });
  }

  // 成员选中 → 记录成员名, 邀请状态置待接受(0)
  function onMemberChange(record: any, v: any) {
    const opt = userOptions.value.find((o) => o.value === v);
    record.memberName = opt?.label || '';
    record.inviteStatus = '0';
  }

  // 发送邀约 → 生成待办(站内待办页处理同意/拒绝)
  async function sendInvite(record: any) {
    if (!record.memberId) {
      createMessage.warning('请先选择成员');
      return;
    }
    try {
      await addInvitation({ periodId: props.periodId, memberId: record.memberId, memberName: record.memberName });
      record.inviteStatus = '0'; // 待接受, 对方在站内待办同意后置 1(已接收)
      createMessage.success(`已向「${record.memberName}」发送邀约`);
    } catch {
      createMessage.warning('邀约发送失败');
    }
  }

  // 移除参与人员
  function removePerson(key: number) {
    personList.value = personList.value.filter((p) => p._key !== key);
  }

  // 添加外协
  function addOutsourcing() {
    outsourcingList.value.push({ _key: ++outsourcingSeed, unit: '', peopleNum: 0, hours: 0, contact: '', phone: '' });
  }

  // 移除外协
  function removeOutsourcing(key: number) {
    outsourcingList.value = outsourcingList.value.filter((p) => p._key !== key);
  }
</script>

<style lang="less" scoped>
  .plan-person {
    &__group {
      margin-bottom: 16px;

      &-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
      }
    }
  }
</style>
