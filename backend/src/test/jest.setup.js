/* Jest 27 node environment lacks Web Streams API globals */
const {TransformStream} = require('stream/web')
global.TransformStream = TransformStream
