export const collectSubtreeIds = (store, rootIds) => {
  const pending = [...rootIds]
  const collected = new Set()

  while (pending.length > 0) {
    const id = pending.pop()
    if (!id || collected.has(id)) continue
    const node = store.getNode(id)
    if (!node) continue
    collected.add(id)
    pending.push(...(node.children ?? []))
  }

  return collected
}
