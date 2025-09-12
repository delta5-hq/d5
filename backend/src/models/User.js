import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

import createSchema from './utils/createSchema'

// https://codahale.com/how-to-safely-store-a-password/
const SALT_COMPUTE_EFFORT = 10

const UserSchema = createSchema({
  id: {type: String, index: {unique: true}, required: true},
  name: {type: String, index: {unique: true}, required: true},
  password: {type: String, select: false},
  mail: {type: String, index: {unique: true}, required: true},
  confirmed: {type: Boolean, required: false},
  roles: [String],
  comment: {type: String},
  limitNodes: Number,
  limitMaps: Number,
  pwdResetToken: {type: String, index: {unique: true, sparse: true}, required: false},
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

UserSchema.pre('save', async function (next) {
  const user = this

  // only hash the password if it has been modified (or is new)
  if (!user.isModified('password')) return next()

  // generate a salt
  const salt = await bcrypt.genSaltSync(SALT_COMPUTE_EFFORT)

  // hash the password using our new salt
  user.password = await bcrypt.hashSync(user.password, salt)
  return next()
})

UserSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password)
}

const User = mongoose.model('User', UserSchema)

export default User
