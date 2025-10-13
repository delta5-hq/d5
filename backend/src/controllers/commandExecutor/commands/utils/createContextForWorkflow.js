export function includesAny(keywords, title) {
  if (!title) {
    return false
  }
  return !keywords.find(s => title.toLocaleLowerCase().includes(s.toLocaleLowerCase()))
}

export function createContextForWorkflow(node, allNodes, filterFunc, parentContext = '') {
  const nodeStrings = []

  node.children
    .map(id => allNodes[id])
    .forEach(childNode => {
      if (filterFunc(childNode)) {
        if (childNode?.children?.length == 0) {
          const childContext = ` in context of "${parentContext}"`
          nodeStrings.push({
            node: childNode,
            context: childNode.title + childContext,
          })
        } else {
          const newParentContext = parentContext ? `${childNode.title}, ${parentContext}` : childNode.title
          nodeStrings.push(...createContextForWorkflow(childNode, allNodes, filterFunc, newParentContext))
        }
      }
    })

  return nodeStrings
}
