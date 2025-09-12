import mongoose from 'mongoose'

import createSchema from './utils/createSchema'
import {Edge, Node} from './Workflow'

const Share = createSchema(
  {
    public: Boolean,
  },
  {_id: false, timestamps: false},
)

const WorkflowTemplateSchema = createSchema({
  userId: {type: String, required: true, index: true},
  name: {type: String, required: true},
  keywords: [String],
  nodes: {type: Map, of: Node, required: true},
  edges: {type: Map, of: Edge},
  root: {type: String, required: true},
  share: Share,
  backgroundImage: {type: String},
})

WorkflowTemplateSchema.methods.isPublic = function () {
  return this.share && !!this.share.public
}

const Template = mongoose.model('Template', WorkflowTemplateSchema)

export default Template
