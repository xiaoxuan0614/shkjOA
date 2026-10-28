/** 仅用于修改新密码；不对已有密码登录施加新规则。 */
export const NEW_PASSWORD_HINT = '8–16位，大小写字母、数字、符号至少包含三类，不含空格';
export function newPasswordError(value: unknown, oldPassword?: string): string {
  if (typeof value !== 'string' || !value) return '请输入新密码';
  if (value.length < 8 || value.length > 16) return '新密码长度须为8–16位';
  if (/\s/.test(value)) return '新密码不能包含空格或换行';
  if (!/^[\x21-\x7e]+$/.test(value)) return '新密码仅支持英文字母、数字和英文符号';
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(rule => rule.test(value)).length;
  if (kinds < 3) return '新密码须包含大小写字母、数字、符号中的至少三类';
  if (/^(password|admin|qwerty|welcome|abc|abcdef)$/i.test(value.replace(/[^a-z]/gi, ''))) return '新密码过于常见，请换一个';
  if (oldPassword && value === oldPassword) return '新密码不能与当前密码相同';
  return '';
}
export function createNewPasswordRule(oldPassword?: () => string) {
  return {
    validator: (_rule: unknown, value: unknown) => {
      const error = newPasswordError(value, oldPassword?.());
      return error ? Promise.reject(new Error(error)) : Promise.resolve();
    },
    trigger: 'blur',
  };
}
