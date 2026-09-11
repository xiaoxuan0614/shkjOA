export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MIN_LENGTH_MESSAGE = `密码至少${PASSWORD_MIN_LENGTH}位`;

export function createPasswordLengthRule() {
  return {
    min: PASSWORD_MIN_LENGTH,
    message: PASSWORD_MIN_LENGTH_MESSAGE,
  };
}

export function isPasswordLengthValid(value?: string) {
  return typeof value === 'string' && value.length >= PASSWORD_MIN_LENGTH;
}
