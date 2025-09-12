import {Entropy} from 'entropy-string'

const entropy = new Entropy({total: 1e5, risk: 1e6})

const generateId = () => entropy.string()

export const generateNodeId = generateId
export const generateEdgeId = (start, end) => `${start}:${end}`

export default generateId
