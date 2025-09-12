import mongoose from 'mongoose'
import debug from 'debug'

import {MONGO_URI, POOL_MAX_IDLE_TIME, POOL_MAX_SIZE, POOL_MIN_SIZE} from './constants'

const log = debug('delta5:db')

export const connectDb = async () => {
  log('Connecting to mongo database ...')
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      minPoolSize: POOL_MIN_SIZE,
      maxPoolSize: POOL_MAX_SIZE,
      maxIdleTimeMS: POOL_MAX_IDLE_TIME,
    })
    log('MongoDB connected successful.')
  } catch (e) {
    console.error(`Could not connect to MongoDB: ${e.message}`)
    process.exit(1)
  }
}

export const closeDb = async () => {
  log('Closing database connection.')
  try {
    // use a callback as nodejs shutdown does not wait for other processes
    await new Promise((resolve, reject) => {
      mongoose.disconnect(error => {
        log('MongoDB connection closed.')
        if (error) reject(error)
        else resolve()
      })
    })
  } catch (e) {
    console.error(`Could not close connection to MongoDB: ${e.message}`)
    process.exit(1)
  }
}

export default mongoose.connection
