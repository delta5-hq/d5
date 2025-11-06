import debug from 'debug'

import Macro from '../models/Macro'

const log = debug('delta5:Macro:Controller')

const MacroController = {
  authorization: async (ctx, next) => {
    const {userId} = ctx.state

    if (!userId) {
      ctx.throw(401, 'Authentication needed.')
    }

    await next()
  },
  create: async ctx => {
    const {userId} = ctx.state
    const macroData = await ctx.request.json()

    log('create macro', {userId})

    try {
      const {name} = macroData

      const existsMacro = await Macro.findOne({name})
      if (existsMacro) {
        ctx.throw(400, 'Macro already exists')
      }
      const macro = new Macro({userId, ...macroData})

      await macro.save()

      ctx.body = {macroId: macro._id}
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
  list: async ctx => {
    const {userId} = ctx.state

    log('list macros', {userId})

    try {
      ctx.body = await Macro.find({userId}).sort([['updatedAt', 'descending']])
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
  get: async ctx => {
    const {macro} = ctx.state

    log('get template', {macroId: macro._id})

    ctx.body = macro
  },
  getByName: async ctx => {
    const {name} = ctx.params

    try {
      const macro = await Macro.findOne({name}).lean()

      ctx.body = macro
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
  delete: async ctx => {
    const {macroId} = ctx.params

    log('delete macro', {macroId})

    try {
      const result = await Macro.deleteOne({_id: macroId})

      log('delete result ', result)
      if (result.deletedCount === 0) {
        ctx.throw(500, 'Cannot delete macro')
      }

      ctx.body = {success: true}
    } catch (e) {
      ctx.throw(500, e.message)
    }
  },
  load: async (ctx, next) => {
    const {macroId} = ctx.params
    const {userId} = ctx.state

    try {
      const macro = await Macro.findOne({_id: macroId})

      if (!macro) {
        const err = new Error('Macro not found.')
        err.code = 404
        throw err
      }

      if (userId !== macro.userId) {
        const err = new Error('Permissions denied.')
        err.code = 403
        throw err
      }

      ctx.state.macro = macro

      await next()
    } catch (err) {
      ctx.throw(err.code || 500, err.message || 'Failed to load macro.')
    }
  },
}

export default MacroController
