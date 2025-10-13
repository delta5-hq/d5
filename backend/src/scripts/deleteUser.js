import debug from 'debug'

import {closeDb, connectDb} from '../db'
import Workflow from '../models/Workflow'
import WorkflowController from '../controllers/WorkflowController'
import Template from '../models/Template'
import User from '../models/User'

const log = debug('delta5:scripts:deleteUser')
const logError = log.extend('ERROR*', '::')

const args = process.argv.slice(2)

const validGroups = ['customer', 'subscriber', 'org_subscriber', 'administrator']

if (args.length !== 1) {
  console.log(`usage: ${process.argv[0]} <userId>`)
  console.log(`groups: ${validGroups.join(',')}`)
  process.exit(1)
}

const [userId] = args

const deleteUser = async () => {
  try {
    log('delete all user related content', userId)

    await connectDb()

    const workflowIds = (await Workflow.find({userId}, {workflowId: 1})).map(({workflowId}) => workflowId)

    if (workflowIds) {
      // use workflow controller to delete workflow related stuff
      await Promise.all(
        workflowIds.map(workflowId => {
          const ctx = {params: {workflowId}, state: {access: {isOwner: true}}}

          log('deleting workflow', workflowId)

          return WorkflowController.delete(ctx)
        }),
      )
    }

    await Template.deleteMany({userId})

    await User.deleteOne({userId})

    log(`successfully deleted user ${userId}`)
    await closeDb()
  } catch (e) {
    logError('Error while saving the user', e)
    await closeDb()
  }
}

deleteUser()
