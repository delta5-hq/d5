import plantuml from 'plantuml'
import fs from 'fs'
import os from 'os'
import path from 'path'
import WorkflowImage from './../../models/WorkflowImage'

const createUMLFile = async (input, filename, metadata) => {
  const svg = await plantuml(input)
  const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'delta5_'))
  const newfile = path.join(tmpdir, filename.replace('.puml', '.svg'))

  await fs.promises.writeFile(newfile, svg)
  const svg_rs = fs.createReadStream(newfile)
  const createdFile = await WorkflowImage.write({filename, metadata}, svg_rs)

  await fs.promises.rm(tmpdir, {recursive: true, force: true})
  return createdFile
}

export default createUMLFile
