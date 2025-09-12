export const sanitizeUsernameOrEmail = str => {
  return str.toLocaleLowerCase().trim()
}
