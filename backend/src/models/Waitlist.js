import mongoose from 'mongoose'
import createSchema from './utils/createSchema'

const WaitlistSchema = createSchema({
  id: {type: String, index: {unique: true}, required: true},
  name: {type: String, index: {unique: true}, required: true},
  password: {type: String, required: true},
  mail: {type: String, index: {unique: true}, required: true},
  meta: {
    store: {
      whatFor: String,
      fieldsOfWork: {
        pupil: String,
        student: String,
        researcher: String,
        consultant: String,
        employee: String,
        freelancer: String,
        founder: String,
        other: String,
      },
      studyPhase: String,
      researcherType: String,
      consultantType: String,
      companySize: String,
      getToKnow: String,
      phoneNumber: String,
      firstName: String,
      lastName: String,
    },
  },
})

const Waitlist = mongoose.model('Waitlist', WaitlistSchema)

export default Waitlist
