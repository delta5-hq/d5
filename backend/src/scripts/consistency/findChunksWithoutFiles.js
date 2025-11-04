import {MongoClient} from 'mongodb'
import debug from 'debug'

import {MONGO_URI, MONGO_DATABASE} from '../../constants'

const log = debug('delta5:scripts:exportWorkflow')

const client = new MongoClient(MONGO_URI)

const deleteChunks = async () => {
  try {
    log('connect to database')
    await client.connect()

    const deleted = {}

    for (const modelName of ['WorkflowImage', 'WorkflowFile']) {
      log(`working on ${modelName}`)

      deleted[modelName] = 0

      const aggregate = [
        {
          $lookup: {
            from: `${modelName}.files`,
            localField: 'files_id',
            foreignField: '_id',
            as: 'file',
          },
        },
        {
          $unwind: {
            path: '$file',
            includeArrayIndex: 'file_index',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {data: 0},
        },
        {
          $match: {
            file: {$exists: false},
          },
        },
      ]

      const collection = client.db(MONGO_DATABASE).collection(`${modelName}.chunks`)

      const result = await collection.aggregate(aggregate)
      const resultArray = await result.toArray()

      await Promise.all(
        resultArray.map(async r => {
          log(r)
          deleted[modelName] += 1
          await collection.deleteOne({_id: r._id})
        }),
      )
    }

    log('deleted: ', deleted)
  } finally {
    log('closing database')
    await client.close()
  }
}

deleteChunks()
