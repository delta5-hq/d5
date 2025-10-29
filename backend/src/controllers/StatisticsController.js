import {emailer} from '../email'
import User from '../models/User'
import Waitlist from '../models/Waitlist'
import Workflow from '../models/Workflow'
import {ROLES} from '../shared/config/constants'
import {createOpenaiIntegration} from './utils/createOpenaiIntegration'

const toCsv = arrayOfArrays =>
  arrayOfArrays.map(array => array.map(field => String(field).replace([';', '\n', '\r'], '')).join(';')).join('\n')

export const userStatisticsAllWorkflows = async (userId = null) => {
  const nodeCount = {$size: {$ifNull: [{$objectToArray: '$nodes'}, []]}}
  const edgeCount = {$size: {$ifNull: [{$objectToArray: '$edges'}, []]}}
  const sharedWith = {
    $ifNull: ['$share.access.subjectId', []],
  }
  const biggestWorkflowCount = {$size: {$ifNull: [{$objectToArray: '$nodes'}, []]}}
  const sharedWithCount = {$size: {$ifNull: ['$share.access', []]}}
  const lastWorkflowChange = {$max: '$updatedAt'}

  const pipeline = [
    {
      $project: {
        userId: 1,
        workflowId: 1,
        createdAt: 1,
        updatedAt: 1,
        nodeCount,
        edgeCount,
        sharedWith,
        title: 1,
        biggestWorkflowCount,
        sharedWithCount,
      },
    },
    {
      $facet: {
        categorizedBySharedWorkflow: [
          {
            $unwind: '$sharedWith',
          },
          {
            $group: {
              _id: '$sharedWith',
              shareCount: {$sum: 1},
            },
          },
        ],
        categorizedByOwnWorkflow: [
          {
            $group: {
              _id: '$userId',
              workflowId: {$addToSet: '$workflowId'},
              workflowCount: {$sum: 1},
              nodeCount: {$sum: '$nodeCount'},
              edgeCount: {$sum: '$edgeCount'},
              biggestWorkflowCount: {$max: '$biggestWorkflowCount'},
              sharedWithCount: {$sum: '$sharedWithCount'},
              lastWorkflowChange,
            },
          },
        ],
      },
    },
    {$project: {result: {$concatArrays: ['$categorizedBySharedWorkflow', '$categorizedByOwnWorkflow']}}},
    {$unwind: {path: '$result'}},
    {$replaceRoot: {newRoot: '$result'}},
    {
      $group: {
        _id: '$_id',
        workflowCount: {$sum: '$workflowCount'},
        shareCount: {$sum: '$shareCount'},
        nodeCount: {$sum: '$nodeCount'},
        edgeCount: {$sum: '$edgeCount'},
        workflowIds: {$addToSet: '$workflowId'},
        sharedWithCount: {$sum: '$sharedWithCount'},
        biggestWorkflowCount: {$max: '$biggestWorkflowCount'},
        lastWorkflowChange: {$max: '$lastWorkflowChange'},
      },
    },
  ]

  if (userId) {
    const filterUser = {$match: {$or: [{userId}, {'share.access.subjectId': userId}]}}
    const finalFilterUser = {$match: {_id: userId}}
    pipeline.unshift(filterUser)
    pipeline.push(finalFilterUser)
    return (await Workflow.aggregate(pipeline))[0]
  }

  return await Workflow.aggregate(pipeline)
}

const StatisticsController = {
  authorization: (ctx, next) => {
    const {auth} = ctx.state

    if (!auth?.roles.includes(ROLES.administrator)) {
      ctx.throw(403, 'This endpoint is only available for administrators.')
    }

    return next()
  },
  userLoad: async (id, ctx, next) => {
    const statisticsUser = await User.findOne({id: id})
    ctx.statisticsUser = statisticsUser
    if (!statisticsUser) ctx.throw(404, 'User not found.')

    return await next()
  },
  workflowServe: async ctx => {
    const cursor = Workflow.find().cursor()

    const lines = [['workflowId', 'userId', 'title', 'nodeCount', 'edgeCount', 'shareCount']]
    for (let obj = await cursor.next(); obj !== null; obj = await cursor.next()) {
      const json = obj.toJSON()
      lines.push([
        json.workflowId,
        json.userId,
        json.title,
        Object.keys(json.nodes || {}).length,
        Object.keys(json.edges || {}).length,
        json.share?.access.length || 0,
      ])
    }

    ctx.body = lines
  },
  workflowCsv: async ctx => {
    ctx.set('Content-disposition', "attachment; filename*=UTF-8''workflows.csv")
    ctx.type = 'text/csv'
    ctx.body = toCsv(ctx.state.lines)
  },
  userActivity: async ctx => {
    ctx.body = await userStatisticsAllWorkflows()
  },
  userList: async ctx => {
    const page = Math.max(parseInt(ctx.query.page) || 1, 1)
    const limit = Math.max(parseInt(ctx.query.limit) || 10, 1)
    const skip = (page - 1) * limit

    const search = ctx.query.search?.trim() || ''

    const query = {}

    if (search) {
      query.$or = [
        {name: {$regex: search, $options: 'i'}},
        {mail: {$regex: search, $options: 'i'}},
        {id: {$regex: search, $options: 'i'}},
      ]
    }
    const statsByUser = Object.fromEntries((await userStatisticsAllWorkflows()).map(data => [data._id, data]))

    const total = await User.countDocuments(query)

    const paginatedUsers = await User.find(query).sort({createdAt: -1}).skip(skip).limit(limit).lean()

    const users = paginatedUsers.map(user => {
      const userId = user.id
      const statistics = statsByUser[userId] || {}

      return {
        id: userId,
        name: user.name || '',
        mail: user.mail || '',
        roles: user.roles || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        limitWorkflows: user.limitWorkflows || null,
        limitNodes: user.limitNodes || null,
        lastWorkflowChange: statistics.lastWorkflowChange || null,
        biggestWorkflowCount: statistics.biggestWorkflowCount || null,
        workflowCount: statistics.workflowCount || 0,
        shareCount: statistics.shareCount || 0,
        sharedWithCount: statistics.sharedWithCount || 0,
        workflowIds: statistics.workflowIds || null,
        sharedWorkflows: statistics.sharedWorkflows || 0,
        nodeCount: statistics.nodeCount || 0,
        edgeCount: statistics.edgeCount || 0,
        meta: user.meta || {},
        comment: user.comment || '',
      }
    })

    ctx.body = {
      total,
      page,
      limit,
      data: users,
    }
  },
  userStatistics: async ctx => {
    const {statisticsUser} = ctx
    if (!statisticsUser) ctx.throw(404, 'User not found.')

    const {id} = statisticsUser
    const statistics = await userStatisticsAllWorkflows(id)

    ctx.body = {
      id: statisticsUser.id,
      name: statisticsUser.name,
      mail: statisticsUser.mail,
      roles: statisticsUser.roles,
      comment: statisticsUser.comment,
      createdAt: statisticsUser.createdAt,
      updatedAt: statisticsUser.updatedAt,
      lastWorkflowChange: statistics?.lastWorkflowChange || null,
      limitWorkflows: statisticsUser.limitWorkflows || null,
      limitNodes: statisticsUser.limitNodes || null,
      biggestWorkflowCount: statistics?.biggestWorkflowCount || 0,
      workflowCount: statistics?.workflowCount || 0,
      shareCount: statistics?.shareCount || 0,
      sharedWithCount: statistics?.sharedWithCount || 0,
      workflowIds: statistics?.workflowIds || null,
      nodeCount: statistics?.nodeCount || 0,
      edgeCount: statistics?.edgeCount || 0,
      meta: statisticsUser.meta || {},
    }
  },
  userComment: async ctx => {
    const {statisticsUser} = ctx
    const payload = await ctx.request.json()
    statisticsUser.comment = payload.data
    await statisticsUser.save()
    ctx.body = {success: true}
  },

  userWorkflowStatistics: async ctx => {
    const {statisticsUser} = ctx
    if (!statisticsUser) ctx.throw(400, 'User not found.')
    const userId = statisticsUser.id
    const filterUser = {$match: {$or: [{userId}, {'share.access.subjectId': userId}]}}

    const nodeCount = {$size: {$ifNull: [{$objectToArray: '$nodes'}, []]}}
    const edgeCount = {$size: {$ifNull: [{$objectToArray: '$edges'}, []]}}
    const sharedWithCount = {$size: {$ifNull: ['$share.access', []]}}
    const role = {
      $ifNull: [
        {
          $reduce: {
            input: {
              $filter: {
                input: '$share.access',
                as: 'shared',
                cond: {$eq: ['$$shared.subjectId', userId]},
              },
            },
            initialValue: null,
            in: '$$this.role',
          },
        },
        'owner',
      ],
    }

    const publicWorkflow = {$ifNull: ['$share.public.enabled', false]}
    const hiddenWorkflow = {$ifNull: ['$share.public.hidden', true]}
    const exportData = {
      $project: {
        userId: 1,
        workflowId: 1,
        createdAt: 1,
        updatedAt: 1,
        nodeCount,
        edgeCount,
        title: 1,
        role: role,
        sharedWithCount,
        public: publicWorkflow,
        hidden: hiddenWorkflow,
      },
    }

    const titleCondition = {
      $cond: {if: {$eq: ['$public', true]}, then: '$title', else: undefined},
    }

    const filterTitle = {
      $project: {
        userId: 1,
        workflowId: 1,
        createdAt: 1,
        updatedAt: 1,
        nodeCount: 1,
        edgeCount: 1,
        title: titleCondition,
        sharedWithCount: 1,
        public: 1,
        hidden: 1,
        role: 1,
      },
    }

    const sort = {$sort: {updatedAt: -1}}

    ctx.body = await Workflow.aggregate([filterUser, exportData, filterTitle, sort])
  },

  userWaitlist: async ctx => {
    const page = Math.max(parseInt(ctx.query.page) || 1, 1)
    const limit = Math.max(parseInt(ctx.query.limit) || 10, 1)
    const skip = (page - 1) * limit

    const search = ctx.query.search?.trim() || ''

    const filter = search
      ? {
          $or: [
            {id: {$regex: search, $options: 'i'}},
            {name: {$regex: search, $options: 'i'}},
            {mail: {$regex: search, $options: 'i'}},
          ],
        }
      : {}

    const users = await Waitlist.find(filter, {id: 1, name: 1, mail: 1, createdAt: 1}).skip(skip).limit(limit).lean()

    const total = await Waitlist.countDocuments({})

    ctx.body = {
      total,
      page,
      limit,
      data: users,
    }
  },

  activateUsersBatch: async ctx => {
    const {ids} = await ctx.request.json()
    if (!Array.isArray(ids) || !ids.length) {
      ctx.throw(400, 'No user IDs provided')
    }
    const results = []

    for (const userId of ids) {
      try {
        const waitlistRecord = await Waitlist.findOne({id: userId})
        if (!waitlistRecord) throw new Error('Waitlist record not found')

        const existingUser = await User.findOne({id: userId})
        if (existingUser) throw new Error('User already exists')

        const user = new User({
          id: waitlistRecord.id,
          name: waitlistRecord.name,
          mail: waitlistRecord.mail,
          password: waitlistRecord.password,
          roles: [ROLES.subscriber],
          confirmed: true,
          rejected: false,
          meta: waitlistRecord.meta,
        })
        user._skipHash = true
        await user.save()
        await Waitlist.deleteOne({id: userId})
        await createOpenaiIntegration(userId)

        emailer.notifyUserOfApproval(waitlistRecord.mail)
        results.push({id: userId, success: true})
      } catch (err) {
        results.push({id: userId, success: false, error: err.message})
      }
    }
    ctx.body = {results}
  },

  rejectUsersBatch: async ctx => {
    const {ids} = await ctx.request.json()
    if (!Array.isArray(ids) || !ids.length) {
      ctx.throw(400, 'No user IDs provided')
    }

    const results = []

    for (const userId of ids) {
      try {
        const waitlistRecord = await Waitlist.findOne({id: userId})
        if (!waitlistRecord) throw new Error('Waitlist record not found')

        await Waitlist.deleteOne({id: userId})
        emailer.notifyUserOfRejection(waitlistRecord.mail)

        results.push({id: userId, success: true})
      } catch (err) {
        results.push({id: userId, success: false, error: err.message})
      }
    }
    ctx.body = {results}
  },

  approveWaitlistUser: async ctx => {
    const {waitUserId} = ctx.params
    const waitlistRecord = await Waitlist.findOne({id: waitUserId})
    if (!waitlistRecord) {
      ctx.throw(404, 'Waitlist record not found')
    }

    const existingUser = await User.findOne({id: waitUserId})
    if (existingUser) {
      ctx.throw(400, 'User already exists')
    }

    const user = new User({
      id: waitlistRecord.id,
      name: waitlistRecord.name,
      mail: waitlistRecord.mail,
      password: waitlistRecord.password,
      roles: [ROLES.subscriber],
      confirmed: true,
      rejected: false,
      meta: waitlistRecord.meta,
    })
    user._skipHash = true
    await user.save()
    await Waitlist.deleteOne({id: waitUserId})
    await createOpenaiIntegration(waitUserId)

    emailer.notifyUserOfApproval(waitlistRecord.mail)

    ctx.body = {success: true}
  },
  rejectWaitlistUser: async ctx => {
    const {waitUserId} = ctx.params

    const waitlistRecord = await Waitlist.findOne({id: waitUserId})
    if (!waitlistRecord) {
      ctx.throw(404, 'Waitlist record not found')
    }

    await Waitlist.deleteOne({id: waitUserId})
    emailer.notifyUserOfRejection(waitlistRecord.mail)

    ctx.body = {success: true}
  },
}

export default StatisticsController
