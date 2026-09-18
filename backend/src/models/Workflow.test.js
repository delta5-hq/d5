import Workflow from './Workflow'

describe('Workflow node title projection schema', () => {
  const nodeFrom = nodes =>
    new Workflow({userId: 'schema-test', nodes, edges: {}, root: 'root'}).toObject({flattenMaps: true}).nodes.root

  it('keeps titleProjection absent for legacy nodes', () => {
    const node = nodeFrom({root: {id: 'root', title: 'Legacy', children: []}})

    expect(node).not.toHaveProperty('titleProjection')
  })

  it('round-trips explicit projection provenance without subdocument metadata', () => {
    const titleProjection = {
      sourceTitle: 'Heading\n  Detail',
      childIds: ['heading'],
      nodeIds: ['heading', 'detail'],
    }
    const node = nodeFrom({
      root: {id: 'root', title: titleProjection.sourceTitle, children: ['heading'], titleProjection},
    })

    expect(node.titleProjection).toEqual(titleProjection)
    expect(node.titleProjection).not.toHaveProperty('_id')
  })
})
