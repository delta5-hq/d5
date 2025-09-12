import LLMVector from '../models/LLMVector'

const LLMVectorController = {
  get: async ctx => {
    try {
      const {userId} = ctx.state
      const {name: contextName = null, type, source} = ctx.query

      let context = await LLMVector.findOne({name: contextName, userId})

      if (!context) {
        ctx.throw(404, 'Context not found')
      }

      if (type) {
        const data = context.store.get(type)
        if (!data) {
          ctx.throw(404, `Type '${type}' not found`)
        }

        if (source) {
          const value = data.get(source)
          if (!value) {
            ctx.throw(404, `'${source}' not found in type "${type}'`)
          }

          ctx.body = {[source]: value}
        } else {
          ctx.body = Object.fromEntries(data)
        }
      } else {
        const fullStore = {}
        for (const [t, tStore] of context.store.entries()) {
          fullStore[t] = Object.fromEntries(tStore)
        }

        ctx.body = fullStore
      }
    } catch (e) {
      ctx.throw(e.statusCode || 500, e.message || 'Internal Server Error')
    }
  },
  getAll: async ctx => {
    try {
      const {userId} = ctx.state

      const contexts = await LLMVector.find({userId}).lean()

      ctx.body = contexts || []
    } catch (e) {
      ctx.throw(e.statusCode || 500, e.message || 'Internal Server Error')
    }
  },
  save: async ctx => {
    try {
      const {userId} = ctx.state
      const {contextName, type, data, keep} = await ctx.request.json('infinity')

      if (!type || !data || typeof data !== 'object' || Array.isArray(data)) {
        ctx.throw(
          400,
          'Invalid payload: "type" and "data" are required, and "data" should be an object with key-value(source - vectors[]) pairs',
        )
      }

      let context = await LLMVector.findOne({name: contextName || null, userId})
      if (!context) {
        context = new LLMVector({
          userId,
          name: contextName || null,
          store: new Map(),
        })
      }

      if (!context.store.has(type)) {
        context.store.set(type, new Map())
      }

      const tStore = context.store.get(type)
      if (!keep) {
        tStore.clear()
      }

      for (const [source, vectors] of Object.entries(data)) {
        if (!source || typeof source !== 'string') {
          ctx.throw(400, `Invalid source key: ${JSON.stringify(source)}`)
        }
        if (!Array.isArray(vectors) || (vectors.length && !vectors.every(v => v?.content || v?.embedding))) {
          ctx.throw(400, `Invalid value for '${source}': ${JSON.stringify(vectors)}`)
        }

        if (tStore.has(source)) {
          const existing = tStore.get(source) || []
          tStore.set(source, [...existing, ...vectors])
        } else {
          tStore.set(source, vectors)
        }
      }

      context.markModified('store')
      await context.save()

      ctx.body = context
    } catch (e) {
      ctx.throw(e.statusCode || 500, e.message || 'Internal Server Error')
    }
  },

  delete: async ctx => {
    try {
      const {userId} = ctx.state
      const {contextName, type, sources} = await ctx.request.json()

      const context = await LLMVector.findOne({name: contextName || null, userId})

      if (!context) {
        ctx.throw(404, 'Context not found')
      }

      if (type && sources && Array.isArray(sources)) {
        const tStore = context.store.get(type)
        if (!tStore) {
          ctx.throw(404, `Type "${type}" not found`)
        }

        sources.forEach(key => {
          if (tStore.has(key)) {
            tStore.delete(key)
          }
        })

        if (tStore.size === 0) {
          context.store.delete(type)
        }

        await context.save()
        ctx.body = {
          message: `Keys ${sources
            .map(k => `"${k}"`)
            .join(', ')} removed from type "${type}" in context "${contextName}"`,
        }
        return
      }

      if (type) {
        const tStore = context.store.get(type)

        if (tStore) {
          tStore.clear()
          await context.markModified('store')
          await context.save()

          ctx.body = {message: `All data cleared from type '${type}' in context '${contextName}'`}
        }
        return
      }

      await context.deleteOne()
      ctx.body = {message: `Context '${contextName}' removed successfully`}
    } catch (e) {
      ctx.throw(e.statusCode || 500, e.message || 'Internal Server Error')
    }
  },
  overview: async ctx => {
    try {
      const {userId} = ctx.state
      const {type: queryType} = ctx.query

      const convert = (acc, context) => {
        const name = context.name || null

        Object.entries(context.store).forEach(([storeType, data]) => {
          if (!queryType || queryType === storeType) {
            if (!acc[name]) acc[name] = {}
            acc[name][storeType] = Object.keys(data)
          }
        })

        return acc
      }

      const contexts = await LLMVector.find({userId}).lean()

      ctx.body = contexts.reduce(convert, {}) || []
    } catch (e) {
      ctx.throw(e.statusCode || 500, e.message || 'Internal Server Error')
    }
  },
}

export default LLMVectorController
