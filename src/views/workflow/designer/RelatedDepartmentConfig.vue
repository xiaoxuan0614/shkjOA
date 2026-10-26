<template>
  <a-form layout="vertical" class="related-config">
    <a-form-item label="部门来源">
      <a-select v-model:value="rule.source" :disabled="repair" :options="sources" @change="rule.fieldKey = ''; delete rule.itemIdPath" />
    </a-form-item>
    <a-form-item label="关联字段" required>
      <a-select v-model:value="rule.fieldKey" :options="options" placeholder="选择部门或成员字段" />
      <p>读取每次申请的字段值，不固定具体部门或主管。</p>
      <p v-if="!options.length" role="status">暂无兼容字段，需要业务目录提供部门／成员字段，不能用备注代替。</p>
    </a-form-item>
    <a-form-item label="对象中的 ID 字段（对象数组时填写）">
      <a-input v-model:value="rule.itemIdPath" placeholder="例如 departmentId；直接 ID 数组留空" @blur="!rule.itemIdPath && delete rule.itemIdPath" />
    </a-form-item>
    <div class="voting-fields">
      <a-form-item label="多个部门之间">
        <a-select v-model:value="rule.departmentMode" :disabled="repair" :options="[{value:'ALL',label:'全部部门通过'},{value:'ANY',label:'任一部门通过'}]" />
      </a-form-item>
      <a-form-item label="同部门多个主管">
        <a-select v-model:value="rule.headMode" :disabled="repair" :options="[{value:'ANY',label:'任一主管通过'},{value:'ALL',label:'全部主管通过'}]" />
      </a-form-item>
    </div>
    <a-form-item label="部门没有主管"><a-input value="停止并提示，不自动通过" disabled /></a-form-item>
    <p v-if="repair">维修内协固定为：部门并行、全部部门通过、同部门任一主管通过。实际协助人员在审批结束后单独指定。</p>
    <p v-else>后端按组织关系解析并冻结主管；此配置只决定审批人，不指定业务参与成员。</p>
  </a-form>
</template>
<script setup lang="ts">
  import { computed } from 'vue';
  import { relatedDepartmentFields, type RelatedDepartmentDesign } from './relatedDepartment';
  const props = defineProps<{ fields: { key: string; name: string; type: string }[]; repair?: boolean }>();
  const rule = defineModel<RelatedDepartmentDesign>('value', { required: true });
  const sources = [{value:'DEPARTMENTS',label:'所选部门'},{value:'MEMBERS',label:'所选成员的所属部门'}];
  const options = computed(() => {
    const options = relatedDepartmentFields(props.fields, rule.value.source);
    const current = props.fields.find(f => f.key === rule.value.fieldKey);
    if (current && !options.some(o => o.value === current.key)) options.push({value:current.key,label:current.name});
    return options;
  });
</script>
<style scoped>
  .related-config p { margin:8px 0 0; color:#545b6c; line-height:1.7; font-size:13px; }
  .voting-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
  @media (max-width:600px) { .voting-fields { grid-template-columns:1fr; gap:0; } }
</style>
