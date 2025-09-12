import {CODE_BLOCK_REGEX} from '../../constants'

export const parseOpenaiJSON = content => {
  return JSON.parse(content.replace(CODE_BLOCK_REGEX, (match, p1) => p1))
}
