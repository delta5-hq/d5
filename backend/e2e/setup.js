import {closeDb, connectDb} from '../src/db'
import Workflow from '../src/models/Workflow'
import WorkflowImage from '../src/models/WorkflowImage'
import WorkflowFile from '../src/models/WorkflowFile'
import Thumbnail from '../src/models/Thumbnail'
import User from '../src/models/User'
import ClientError from '../src/models/ClientError'

export const isHttpMode = () => !!process.env.E2E_SERVER_URL

export const setupDb = async () => {
  // Skip database connection in HTTP mode to avoid dual mongoose instances
  if (isHttpMode()) {
    console.log('HTTP mode detected - skipping database connection (using server\'s connection)')
    return
  }
  
  await connectDb()
  await Promise.all([
    ClientError.init(),
    Workflow.init(),
    WorkflowImage.model.init(),
    WorkflowFile.model.init(),
    Thumbnail.model.init(),
    User.init(),
  ])
}

export const teardownDb = async () => {
  // Skip database disconnection in HTTP mode
  if (isHttpMode()) {
    console.log('HTTP mode detected - skipping database disconnection')
    return
  }
  
  await closeDb()
}
