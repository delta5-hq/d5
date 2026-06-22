import revision from '../revision/bakedRevision'

const buildRevision = async ctx => {
  ctx.status = 200
  ctx.body = {revision}
}

export default buildRevision
