import {getMetrics} from './prometheus'

const serveMetrics = async ctx => (ctx.body = await getMetrics())

export default serveMetrics
