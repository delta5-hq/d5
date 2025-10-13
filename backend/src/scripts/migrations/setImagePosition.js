import {closeDb, connectDb} from '../../db'

import Workflow from '../../models/Workflow'
import {IMAGE_POSITIONS} from '../../shared/config/constants'

const run = async () => {
  await connectDb()

  const cursor = Workflow.find({imagePosition: null}).cursor()

  for (let workflow = await cursor.next(); workflow !== null; workflow = await cursor.next()) {
    console.log(`Workflow ID: ${workflow._id}`)
    let changed = false
    if (workflow.nodes) {
      workflow.nodes.forEach(node => {
        console.log(`node and image ID: ${node.id} ${node.image}`)
        if (node.image) {
          changed = true
          if (node.id.startsWith('urn:imapping')) {
            node.imagePosition = IMAGE_POSITIONS.body
          } else {
            node.imagePosition = IMAGE_POSITIONS.stretch
          }
        }
      })
    }

    if (changed) {
      await workflow.save()
    }
  }

  await closeDb()
}

run()
