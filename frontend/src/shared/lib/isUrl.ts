import { TLDs } from 'global-tld-list'

const protocol = '([A-Za-z]{3,9}:(//)?)'
const userinfo = '([-;:&=+$,\\w]+@)'
const host = '(?<host>([-a-zA-Z0-9\\._]{1,254})\\.(?<tld>[a-z]+))'
const port = '(:[0-9]{2,5})'
const path = '([^?# ]*)'
const param = '(\\?[^?# ]*)'
const anchor = '(#[^ ]*)'

const httpRegex = new RegExp(`^(${protocol}(${userinfo})?)?${host}(${port})?(${path})?(${param})?(${anchor})?$`)

const telRegex = /^tel:+?[0-9()]+$/

const fileRegex = /^[A-Za-z+]{3,9}:[/]{2,3}[^ \\]*$/

const isHttpRegex = (urlCandidate: string): boolean => {
  const regMatch = httpRegex.exec(urlCandidate)
  if (!regMatch?.groups?.tld) return false
  return TLDs.tlds.has(regMatch.groups.tld)
}

const isUrl = (urlCandidate: string): boolean =>
  isHttpRegex(urlCandidate) || telRegex.test(urlCandidate) || fileRegex.test(urlCandidate)

export default isUrl
