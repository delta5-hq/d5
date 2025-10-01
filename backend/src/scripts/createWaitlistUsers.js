import crypto from 'crypto'
import Waitlist from '../models/Waitlist'
import {closeDb, connectDb} from '../db'

const randomId = () => crypto.randomUUID()

const createWaitlistUsers = async count => {
  try {
    await connectDb()

    for (let i = 0; i < count; i++) {
      const id = randomId()
      const name = `user_${id.slice(0, 8)}`
      const mail = `${name}@example.com`
      const password = 'password123'
      const meta = {
        store: {
          whatFor: 'test',
          fieldsOfWork: {
            pupil: null,
            student: null,
            researcher: null,
            consultant: null,
            employee: null,
            freelancer: null,
            founder: null,
            other: null,
          },
          studyPhase: null,
          researcherType: null,
          consultantType: null,
          companySize: null,
          getToKnow: null,
          phoneNumber: null,
          firstName: 'Test',
          lastName: 'User',
        },
      }

      const user = new Waitlist({id, name, mail, password, meta})
      await user.save()
      console.log(`Created user: ${name} (${id})`)
    }

    console.log(`Successfully created ${count} waitlist users.`)
    await closeDb()
  } catch (err) {
    console.error('Error creating waitlist users:', err)
    await closeDb()
  }
}

const args = process.argv.slice(2)
if (args.length !== 1) {
  console.log(`Usage: ${process.argv[0]} ${process.argv[1]} <number-of-users>`)
  process.exit(1)
}

const count = parseInt(args[0], 10)
if (isNaN(count) || count <= 0) {
  console.error('Please provide a valid positive number of users.')
  process.exit(1)
}

createWaitlistUsers(count)
