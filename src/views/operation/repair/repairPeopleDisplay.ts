import type { Row } from './repair.api';
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
// Historical names must come from visible snapshots, not today's user/role configuration.
function name(value: unknown, ids: unknown[], missing: string) {
  const label = text(value);
  return label && !ids.some(id => id != null && label === String(id)) && !/^\d{15,}$|^[a-f0-9]{32}$|^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(label) ? label : missing;
}
const typeName = (value: unknown) => ({ INTERNAL:'内部人员', EXTERNAL:'外协人员' }[String(value)] || '未提供人员类型');
export function peopleRows(key: string, data: Row): Row[] {
  const rows: Row[] = Array.isArray(data[key]) ? data[key] : [];
  const members: Row[] = Array.isArray(data.members) ? data.members : [];
  if (key === 'workPersons') return rows.map(row => {
    const member = row.memberId ? members.find(item => item.id === row.memberId) : undefined;
    return { ...row,
      personName: name(row.personNameSnapshot || member?.userNameSnapshot, [row.userId,row.sourcePersonId,member?.userId], '未提供姓名'),
      roleName: name(member?.roleNameSnapshot, [member?.roleId], '未提供角色'),
      personTypeName: typeName(row.personType),
    };
  });
  if (key === 'members') return rows.map(row => ({ ...row,
    personName: name(row.userNameSnapshot, [row.userId,row.sourcePersonId], '未提供姓名'),
    roleName: name(row.roleNameSnapshot, [row.roleId], '未提供角色'),
    personTypeName: typeName(row.personType),
    memberState: ({ ACTIVE:'协助中', EXITED:'已退出' }[String(row.memberStatus)] || '未提供状态'),
  }));
  if (key === 'assignments') return rows.map(row => ({ ...row,
    fromName: !row.fromUserId && !row.fromNameSnapshot ? '首次派单' : name(row.fromNameSnapshot, [row.fromUserId], '未提供姓名'),
    toName: name(row.toNameSnapshot, [row.toUserId], '未提供姓名'),
    assignmentTypeName: ({ AUTO_ROSTER:'按排班自动派单', APPROVED_TRANSFER:'审批转单' }[String(row.assignmentType)] || '其他派单'),
  }));
  return rows;
}
