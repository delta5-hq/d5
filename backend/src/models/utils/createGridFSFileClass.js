import {createModel} from 'mongoose-gridfs'
import {capitalize, lowerCaseFirst} from '../../utils'
import connection from '../../db'

const callbackToPromise = (object, fnName) => {
  const originalFn = object[fnName]
  object[fnName] = (...args) =>
    new Promise((resolve, reject) => {
      originalFn.call(object, ...(args || []), (error, created) => {
        if (error) {
          reject(error)
        } else {
          resolve(created)
        }
      })
    })
}

const replaceCallbacksWithPromises = instance => {
  callbackToPromise(instance, 'write')
  callbackToPromise(instance, 'unlink')
  return instance
}

const createGridFSFileClass = name => {
  let Model

  // wrap it up, as the connection is not yet available when the program starts up and createModel throws an error
  const getModel = () => {
    if (!Model) {
      Model = createModel({
        modelName: capitalize(name),
        bucketName: lowerCaseFirst(name),
        connection,
      })
    }
    return Model
  }

  class GridFSFileClass {
    type = name

    static get model() {
      return getModel()
    }

    constructor(...args) {
      const instance = new (getModel())(...args)
      return replaceCallbacksWithPromises(instance)
    }

    static findOne(filter) {
      return new Promise((resolve, reject) =>
        getModel().findOne(filter, (err, found) => {
          if (err) {
            reject(err)
          } else {
            if (found) {
              resolve(replaceCallbacksWithPromises(found))
            } else {
              resolve(null)
            }
          }
        }),
      )
    }

    static find(filter, projection = {}) {
      return new Promise((resolve, reject) =>
        getModel().find(filter, projection, (err, found) => {
          if (err) {
            reject(err)
          } else {
            if (found) {
              resolve(found.map(f => replaceCallbacksWithPromises(f)))
            } else {
              resolve(null)
            }
          }
        }),
      )
    }

    static deleteMany(filter) {
      return new Promise((resolve, reject) =>
        getModel().deleteMany(filter, (err, found) => {
          if (err) {
            reject(err)
          } else {
            if (found) {
              resolve(found)
            } else {
              resolve(null)
            }
          }
        }),
      )
    }

    static async write(options, readStream) {
      let result
      await new Promise(function (resolve) {
        getModel().write(options, readStream, (error, file) => {
          result = file
          resolve()
        })
      })

      return result
    }
  }

  return GridFSFileClass
}

export default createGridFSFileClass
