export function getByIndexSafe(arr, index) {
  if (typeof arr === 'string') {
    return arr
  }
  return arr[index]
}

export function createChildren(arr) {
  if (!arr) {
    return []
  }
  if (typeof arr === 'string') {
    return [createItem(arr)]
  }
  return arr.map(x => createItem(getByIndexSafe(x, 0)))
}

export function createItem(str, arr) {
  return {
    name: str,
    children: createChildren(arr),
  }
}

export function findNode(nodes, name) {
  let result
  nodes.forEach(node => {
    if (node.children?.length) {
      const found = findNode(node.children, name)
      if (found) {
        result = found
      }
    }
    if (node.name.toLowerCase() === name.toLowerCase()) {
      result = node
    }
  })

  return result
}

export function deleteNodeByName(nodes, name) {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]

    if (node.children?.length) {
      if (deleteNodeByName(node.children, name)) {
        node.children = node.children.filter(child => child.name !== name)
        return true
      }
    }

    if (node.name.toLowerCase() === name.toLowerCase()) {
      nodes.splice(i, 1)
      return true
    }
  }

  return false
}

export function serializeNode(node, indent = 0) {
  let result = indent ? `${' '.repeat(indent)}${node.name}` : node.name
  if (node.children) {
    result += `\n${node.children.map(x => serializeNode(x, indent + 2)).join('')}`
  }
  return result
}

export function createTree(subtrees) {
  const firstSubtree = subtrees.shift()

  const firstResult = createItem(getByIndexSafe(firstSubtree, 0), getByIndexSafe(firstSubtree, 1))

  const tree = [firstResult]

  subtrees.forEach(subtree => {
    const name = getByIndexSafe(subtree, 0)
    const existingNode = findNode(tree, name)
    if (existingNode && existingNode.children) {
      const children = createChildren(getByIndexSafe(subtree, 1))
      children.forEach(item => {
        if (!item.children?.length) {
          deleteNodeByName(tree, item.name)
        }
      })
      existingNode.children = [...existingNode.children, ...children]
    } else {
      tree.push(createItem(name, getByIndexSafe(subtree, 1)))
    }
  })

  return tree.map(x => serializeNode(x)).join('')
}
