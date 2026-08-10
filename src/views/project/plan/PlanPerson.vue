<template>
  <div class="plan-person">
    <!-- 参与人员信息 -->
    <div class="plan-person__group">
      <div class="plan-person__group-title">
        <span>参与人员信息</span>
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
            <a-input v-model:value="record.member" placeholder="请输入成员" :disabled="!editable" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="editable" type="link" danger size="small" @click="removePerson(record._key)">删除</a-button>
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
            <a-input v-model:value="record.unit" placeholder="请输入外协单位" :disabled="!editable" />
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
  import { ref, unref } from 'vue';

  // 属性: editable 控制是否可编辑
  defineProps<{
    editable?: boolean;
  }>();

  // 角色下拉
  const roleOptions = [
    { label: '项目负责人', value: '项目负责人' },
    { label: '现场负责人', value: '现场负责人' },
    { label: '技术负责人', value: '技术负责人' },
    { label: '施工人员', value: '施工人员' },
    { label: '安全员', value: '安全员' },
  ];

  // 参与人员
  const personColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '角色', key: 'role', width: 180 },
    { title: '成员', key: 'member' },
    { title: '操作', key: 'action', width: 80, align: 'center' },
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
      personList.value = (data?.personList || []).map((item) => ({ ...item, _key: ++personSeed }));
      outsourcingList.value = (data?.outsourcingList || []).map((item) => ({ ...item, _key: ++outsourcingSeed }));
    },
  });

  // 添加参与人员
  function addPerson() {
    personList.value.push({ _key: ++personSeed, role: undefined, member: '' });
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
