import log from 'loglevel'
import { IS_DEV } from '@/shared/config/api'

const level = IS_DEV ? 'debug' : 'info'
log.setLevel(level)

export default log
