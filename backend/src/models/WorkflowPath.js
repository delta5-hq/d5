import mongoose from 'mongoose'

import createSchema from './utils/createSchema'

const Path = createSchema({
  mapId: {type: String, required: true},
  nodes: [String],
  title: String,
})

const WorkflowPath = mongoose.model('WorkflowPath', Path)

export default WorkflowPath
