import mongoose from 'mongoose'

import createSchema from './utils/createSchema'
import {Node} from './Workflow'

const MacroSchema = createSchema({
  userId: {type: String, required: true, index: true},
  name: {type: String, required: true, unique: true},
  keywords: [String],
  queryType: {type: String, required: true},
  cell: {type: Node, required: true},
  workflowNodes: {type: Map, of: Node, required: true},
})

const Macro = mongoose.model('Macro', MacroSchema)

export default Macro
