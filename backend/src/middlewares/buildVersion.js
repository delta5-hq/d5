import version from '../version/bakedVersion'

const buildVersion = async ctx => {
  ctx.status = 200
  ctx.body = {version}
}

export default buildVersion
