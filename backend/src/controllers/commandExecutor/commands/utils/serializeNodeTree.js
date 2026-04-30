const nodeLabel = node => node.title || (node.gridOptions ? '(table)' : '(untitled)')

const walkNode = (node, allNodes, depth, lines) => {
  lines.push('  '.repeat(depth) + nodeLabel(node))
  ;(node.children || [])
    .map(id => allNodes[id])
    .filter(Boolean)
    .forEach(child => walkNode(child, allNodes, depth + 1, lines))
}

const serializeNodeTree = (outputNodes, allNodes) => {
  const roots = outputNodes.filter(node => !outputNodes.some(other => other.id === node.parent))
  const lines = []
  roots.forEach(root => walkNode(root, allNodes, 0, lines))
  return lines.join('\n')
}

export default serializeNodeTree
