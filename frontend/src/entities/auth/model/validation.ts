const usernameOrEmailPattern = /\S\s+\S/

export const validateUsernameOrEmail = (str: string) => usernameOrEmailPattern.test(str)

const oneDigit = /^(?=.*\d)/
const oneUpperCase = /^(?=.*[A-Z])/
const oneSpecialCharacter = /[^a-zA-Z0-9]/

export function isValidPassword(str: string) {
  if (!str) {
    return false
  }
  return (
    oneDigit.test(str) && oneUpperCase.test(str) && oneSpecialCharacter.test(str) && str.length > 7 && str.length < 36
  )
}
