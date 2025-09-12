export const nodesArrToObj = nodes =>
  nodes.reduce((acc, node) => {
    acc[node.id] = node
    return acc
  }, {})
