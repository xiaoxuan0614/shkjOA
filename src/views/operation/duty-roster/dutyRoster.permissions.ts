import { computed } from 'vue';
import { usePermission } from '/@/hooks/web/usePermission';

/** 按钮码需在后台同名配置并授权；不按业务角色放行，也不在缺少配置时默认开放。 */
export const DUTY_ROSTER_PERMISSIONS = {
  add: 'operation:dutyRoster:add',
  edit: 'operation:dutyRoster:edit',
  export: 'operation:dutyRoster:export',
} as const;

export function useDutyRosterPermissions() {
  const { hasPermission } = usePermission();
  return {
    canAdd: computed(() => hasPermission(DUTY_ROSTER_PERMISSIONS.add)),
    canEdit: computed(() => hasPermission(DUTY_ROSTER_PERMISSIONS.edit)),
    canExport: computed(() => hasPermission(DUTY_ROSTER_PERMISSIONS.export)),
  };
}
