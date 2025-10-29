import mongoose from 'mongoose'

import createSchema from './utils/createSchema'

const Path = createSchema({
  workflowId: {type: String, required: true},
  nodes: [String],
  title: String,
})

const WorkflowPath = mongoose.model('WorkflowPath', Path)

export default WorkflowPath
