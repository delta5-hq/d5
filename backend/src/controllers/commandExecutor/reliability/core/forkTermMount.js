// Inserts the wrapped term as the elect's parent inside a single disposable fork store,
// so the term executes through the ordinary command path while the outer store stays
// pristine. Isolated to one fork, this mutation carries no concurrency window and cannot
// orphan a real node: the ancestor link is rewritten only in the clone.
export const mountTermInFork = (forkStore, termParent, electId, ancestorId) => {
  const synth = {...termParent, children: [electId]}
  forkStore._nodes[synth.id] = synth

  const electNode = forkStore.getNode(electId)
  if (electNode) electNode.parent = synth.id

  const ancestor = ancestorId != null ? forkStore.getNode(ancestorId) : null
  if (ancestor?.children) {
    ancestor.children = ancestor.children.map(id => (id === electId ? synth.id : id))
  }
}
