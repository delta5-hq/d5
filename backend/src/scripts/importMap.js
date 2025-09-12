import fs from 'fs/promises'
import {Readable} from 'stream'
import debug from 'debug'

import {closeDb, connectDb} from '../db'
import Workflow from '../models/Workflow'
import WorkflowImage from '../models/WorkflowImage'
import WorkflowFile from '../models/WorkflowFile'

const log = debug('delta5:scripts:exportMap')

const args = process.argv.slice(2)

if (args.length !== 2) {
  console.log(`usage: ${process.argv[0]} ${process.argv[1]} <path-to-import-file> <user-id>`)
  process.exit(1)
}

const [filePath, userId] = args

const saveFile = async (Model, {data, _id, filename, metadata}) => {
  const file = new Model({_id, filename, metadata})
  const readable = new Readable()
  readable._read = () => {}
  readable.push(Buffer.from(data, 'base64'))
  readable.push(null)

  await file.write(readable)
}

const compact = async () => {
  try {
    await connectDb()

    const {images, documents, ...mapData} = JSON.parse(await fs.readFile(filePath))

    await Promise.all(images.map(image => saveFile(WorkflowImage, image)))
    await Promise.all(documents.map(image => saveFile(WorkflowFile, image)))

    await new Workflow({...mapData, userId}).save()
  } catch (e) {
    log.extend(':ERROR')('error while exporting workflow', e)
  } finally {
    await closeDb()
  }
}

compact()
