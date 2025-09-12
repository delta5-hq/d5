import User from '../../models/User'
import {closeDb, connectDb} from '../../db'

const migrateLocalUsers = async () => {
  await connectDb()
  try {
    const users = await User.find({id: {$exists: 0}})

    for (const user of users) {
      console.log(`migrating ${user.name}`)
      user.id = user.name
      user.save()
    }

    console.log('successfully migrated all local users')
  } catch (e) {
    console.error('Error while saving the user', e)
  } finally {
    await closeDb()
  }
}

migrateLocalUsers()
