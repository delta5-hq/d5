import {z} from 'zod'

export const buildUnionSchema = (memberSchemas, recurse) => {
  const members = memberSchemas.map(recurse)
  if (members.length === 0) return z.never()
  if (members.length === 1) return members[0]
  return z.union(members)
}

export const buildAllOfSchema = (memberSchemas, recurse) => {
  if (memberSchemas.length === 0) return z.any()
  return memberSchemas.map(recurse).reduce((acc, m) => z.intersection(acc, m))
}
