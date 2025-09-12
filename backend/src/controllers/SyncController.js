import debug from 'debug'
import {SYNC_USER_ID} from '../constants'
import User from '../models/User'

const log = debug('delta5:rest:SyncController')

const SyncController = {
  authorization: async (ctx, next) => {
    const {userId} = ctx.state

    log('authorize', userId)

    if (!SYNC_USER_ID) {
      ctx.throw(500, 'Not configured.')
    } else if (userId !== SYNC_USER_ID) {
      ctx.throw(403, 'Access denied.')
    }

    await next()
  },

  allUser: async ctx => {
    const payload = await ctx.request.json()

    const userDataList = Array.isArray(payload) ? payload : [payload]

    log('sync user', userDataList.length)

    let errors = {}

    await Promise.all(
      userDataList.map(async (userData, i) => {
        if (!userData.id) {
          errors[i] = 'Id missing.'
        } else if (!userData.name) {
          errors[i] = `User '${userData.id}': Username missing.`
        } else {
          const {id, name, mail, roles} = userData

          const user = (await User.findOne({id})) || new User({id})
          user.name = name
          // social media users may have no mail address
          if (mail) user.mail = mail
          user.roles = roles
          await user.save()
        }
      }),
    )

    if (Object.keys(errors).length > 0) {
      const errorString = Object.entries(errors)
        .map(([i, error]) => `index ${i}: ${error}`)
        .join(', ')
      ctx.throw(400, `Error in some user objects: ${errorString}`)
    }

    ctx.body = {success: true}
  },
  allUserMetaData: async ctx => {
    const payload = await ctx.request.json()

    const userMetaDataList = Array.isArray(payload) ? payload : [payload]

    let errors = {}

    await Promise.all(
      userMetaDataList.map(async (userMetaData, i) => {
        if (!userMetaData.id) {
          errors[i] = 'Id missing.'
        } else {
          const {
            Delta5_WhatFor,
            Demographics_Pupil,
            Demographics_Student,
            Demographics_Researcher,
            Demographics_Consultant,
            Demographics_Employee,
            Demographics_Freelancer,
            Demographics_Founder,
            Demographics_Other,
            Demographics_StudyPhase,
            Demographics_ResearcherType,
            Demographics_ConsultantType,
            Demographics_CompanySize,
            Delta5_GetToKnow,
            Demographics_PhoneNumber,
            Demographics_FirstName,
            Demographics_LastName,
          } = JSON.parse(userMetaData.userdata)
          const user = (await User.findOne({id: userMetaData.id})) || new User({id: userMetaData.id})

          const fieldsOfWork = {
            pupil: Demographics_Pupil,
            student: Demographics_Student,
            researcher: Demographics_Researcher,
            consultant: Demographics_Consultant,
            employee: Demographics_Employee,
            freelancer: Demographics_Freelancer,
            founder: Demographics_Founder,
            other: Demographics_Other,
          }

          user.meta = {
            store: {
              whatFor: Delta5_WhatFor,
              fieldsOfWork,
              studyPhase: Demographics_StudyPhase,
              researcherType: Demographics_ResearcherType,
              consultantType: Demographics_ConsultantType,
              companySize: Demographics_CompanySize,
              getToKnow: Delta5_GetToKnow,
              phoneNumber: Demographics_PhoneNumber,
              firstName: Demographics_FirstName,
              lastName: Demographics_LastName,
            },
          }
          await user.save()
        }
      }),
    )

    if (Object.keys(errors).length > 0) {
      const errorString = Object.entries(errors)
        .map(([i, error]) => `index ${i}: ${error}`)
        .join(', ')
      ctx.throw(400, `Error in some user objects: ${errorString}`)
    }

    ctx.body = {success: true}
  },
}

export default SyncController
