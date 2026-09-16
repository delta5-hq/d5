// Inserts the wrapped term into a single disposable fork store so the term executes through the
// ordinary command path while the outer store stays pristine. Isolated to one fork, these mutations
// carry no concurrency window and cannot orphan a real node: links are rewritten only in the clone.

// Single-command term (e.g. `/elect :n=N /chat`): the term is the elect's parent, so the command runs
// on the synthetic node and its output attaches there. The elect node is reparented beneath it.
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

// Sequencing term (`/elect :n=N /steps`): /steps owns the ordering. The synthetic node adopts the
// elect's own step children — the same node ids, which stay listed on the elect too — so StepsCommand
// sequences them and their fork outputs attach to those shared step nodes. The synth is appended to
// the ancestor rather than replacing the elect, and the elect keeps its ancestor parent so both
// survive orphan collection (which requires each node's parent to list it as a child). Because the
// step nodes remain under the elect, both readers see the same fork output: the judge collects the
// synth subtree, and the validator reads the elect's own step subtree (see ValidateCommand).
export const mountSequencingTermInFork = (forkStore, termParent, electId, ancestorId) => {
  const electNode = forkStore.getNode(electId)
  const promptIds = new Set(electNode?.prompts ?? [])
  const stepChildren = (electNode?.children ?? []).filter(id => !promptIds.has(id))

  const synth = {...termParent, children: stepChildren, prompts: []}
  forkStore._nodes[synth.id] = synth

  const ancestor = ancestorId != null ? forkStore.getNode(ancestorId) : null
  if (ancestor?.children && !ancestor.children.includes(synth.id)) {
    ancestor.children = [...ancestor.children, synth.id]
  }
}
