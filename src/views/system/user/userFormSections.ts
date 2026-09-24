export const advancedUserFields = new Set([
  'workNo', 'positionType', 'mainDepPostId', 'otherDepPostId', 'sort', 'avatar',
  'birthday', 'sex', 'email', 'telephone', 'activitiSync', 'izHideContact',
]);

/** 只保留表单声明字段，不能将列表辅助字段提交给用户编辑接口。 */
export function mergeUserFormValues(schemas, original, current, validated) {
  const values = {};
  for (const { field } of schemas) {
    for (const source of [original, current, validated]) {
      if (source?.[field] !== undefined) values[field] = source[field];
    }
  }
  return values;
}
