import {Counter, exponentialBuckets, Histogram, register} from 'prom-client'
import {Transform} from 'stream'

class PassthroughSizeCounter extends Transform {
  length = 0

  _transform = (chunk, encoding, callback) => {
    this.length += chunk.length
    this.push(chunk)
    callback()
  }
}

export function getMetrics() {
  return register.metrics()
}

const labelNames = ['method', 'path', 'status']

const defaultOptions = {
  ignore: false,
  stripUrlParams: true,
  durationBuckets: [0.002, 2, 10],
  sizeBuckets: [16, 3, 10],
}

/**
 * Middleware-generating function. Call this during app.use().
 * Will track request duration and number of requests for every route.
 *
 * @see @koa/router/lib/router.js::Router.prototype.routes
 * @param options Options to provide for the middleware. @see defaultOptions
 * @returns {function} Prometheus middleware
 */
export default function createPrometheusMiddleware(options) {
  const {durationPercentiles, durationBuckets, sizePercentiles, sizeBuckets} = {
    ...defaultOptions,
    ...options,
  }

  const requestCount = new Counter({
    name: 'http_request_count',
    help: 'number of requests to a route',
    labelNames,
  })

  const durationMetric = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames,
    buckets: exponentialBuckets(...durationBuckets),
    percentiles: durationPercentiles,
  })

  const requestSizeMetric = new Histogram({
    name: 'http_request_size_bytes',
    help: 'Size of HTTP requests in bytes',
    labelNames,
    buckets: exponentialBuckets(...sizeBuckets),
    percentiles: sizePercentiles,
  })

  const responseSizeMetric = new Histogram({
    name: 'http_response_size_bytes',
    help: 'Size of HTTP requests in bytes',
    labelNames,
    buckets: exponentialBuckets(...sizeBuckets),
    percentiles: sizePercentiles,
  })

  return async (ctx, next) => {
    const {method, url, length: requestSize = 0} = ctx.request

    // track time to respond
    const start = process.hrtime()

    await next()

    const {matched} = ctx

    let path
    if (matched?.length) {
      const lastLayer = [...matched].reverse().find(layer => layer.methods.length > 0)
      path = lastLayer?.path || url
    } else {
      // this means, no router matched, that means a 404 situation for /api
      path = url
    }

    const [seconds, nanoseconds] = process.hrtime(start)
    const duration = seconds + nanoseconds / 1000000000

    const {status, length} = ctx.response

    // track request rate
    requestCount.labels(method, path, status).inc()

    requestSizeMetric.labels(method, path, status).observe(requestSize || 0)

    const {body, res} = ctx
    let counter
    if (length !== null) {
      responseSizeMetric.labels(method, path, status).observe(length || 0)
    } else if (body && body.readable) {
      counter = new PassthroughSizeCounter()
      ctx.body = body.pipe(counter).on('error', ctx.onerror)

      const addResponseSize = () => {
        res.removeListener('finish', addResponseSize)
        res.removeListener('close', addResponseSize)
        responseSizeMetric.labels(method, path, status).observe(counter.length)
      }

      res.once('finish', addResponseSize)
      res.once('close', addResponseSize)
    }

    durationMetric.labels(method, path, status).observe(duration)
  }
}
