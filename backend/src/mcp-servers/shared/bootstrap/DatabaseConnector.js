import {connectDb, closeDb} from '../../../db'

export class DatabaseConnector {
  async connect() {
    await connectDb()
  }

  async disconnect() {
    await closeDb()
  }
}
