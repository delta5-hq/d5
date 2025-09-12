import mongoose from 'mongoose'

import createSchema from './utils/createSchema'
import generateId from '../shared/utils/generateId'
import {ACCESS_ROLES, MEDIA_POSITIONS} from '../shared/config/constants'

const {Types} = mongoose.Schema

export const NodeTag = createSchema(
  {
    id: String,
    name: String,
    color: String,
  },
  {_id: false, timestamps: false},
)

export const Node = createSchema(
  {
    id: {type: String, required: true},
    children: {type: [String]},
    image: Types.ObjectId,
    imagePosition: {type: String, enum: Object.values(MEDIA_POSITIONS)},
    video: {type: String, required: false},
    file: Types.ObjectId,
    title: String,
    collapsed: Boolean,
    color: String,
    borderColor: String,
    scale: Number,
    parent: String,
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    tags: {type: [String]},
    autoshrink: {type: Boolean, default: false},
    command: {type: String, required: false},
    prompts: {type: [String]},
  },
  {_id: false, timestamps: false},
)

export const Edge = createSchema(
  {
    id: {type: String, required: true},
    start: String,
    end: String,
    title: String,
    color: String,
  },
  {_id: false, timestamps: false},
)

const RoleBinding = createSchema(
  {
    subjectId: {type: String, required: true},
    subjectType: {type: String, enum: ['user', 'group', 'mail'], required: true},
    role: {type: String, enum: Object.values(ACCESS_ROLES), required: true},
  },
  {_id: false, timestamps: false},
)

const Share = createSchema(
  {
    public: {
      enabled: Boolean,
      hidden: Boolean,
      writeable: Boolean,
    },
    // link: {
    //   id: String,
    //   password: {type: String, select: false},
    //   until: {type: Types.Datetime},
    // },
    access: [RoleBinding],
  },
  {_id: false, timestamps: false},
)

// const config = {
//   titleLeftMargin: 13,
//   titleRightMargin: 5,
//   titleTopMargin: 15,
//   titleBottomMargin: 5,
//   titleJustifyLines: 4,
//   roundCornerWidth: 5,
//   headerLineMargin: 13,
//   oddColor: '#ffffff',
//   oddOpacity: 0.44,
//   zoomMargin: 20,
//   edgeTextDistance: 2,
// }
//     config: {
//       titleLeftMargin: Number,
//       titleRightMargin: Number,
//       titleTopMargin: Number,
//       titleBottomMargin: Number,
//       titleJustifyLines: Number,
//       roundCornerWidth: Number,
//       headerLineMargin: Number,
//       oddColor: String,
//       oddOpacity: Number,
//       zoomMargin: Number,
//       edgeTextDistance: Number,
//     },

const WorkflowSchema = createSchema({
  mapId: {type: String, index: true, default: generateId},
  userId: {type: String, required: true, index: true},
  title: String,
  nodes: {type: Map, of: Node},
  edges: {type: Map, of: Edge},
  root: String,
  tags: {type: [NodeTag]},
  share: Share,
  category: String,
})

WorkflowSchema.methods.isPublic = function () {
  return Boolean(this.share?.public?.enabled)
}
WorkflowSchema.methods.isPublicWriteable = function () {
  return Boolean(this.share?.public?.enabled && this.share?.public?.writeable)
}

const Workflow = mongoose.model('Workflow', WorkflowSchema)

export default Workflow
