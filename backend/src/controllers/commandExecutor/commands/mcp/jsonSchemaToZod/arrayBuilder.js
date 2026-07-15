import {z} from 'zod'
import {applyArrayConstraints} from './constraints'

export const buildArraySchema = (schema, recurse) => {
  const itemsSchema = schema.items ? recurse(schema.items) : z.any()
  return applyArrayConstraints(z.array(itemsSchema), schema)
}
