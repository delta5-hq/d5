export class OutputNodeValidator {
  static expectNodeWithTitle(output, {title, parentId}) {
    expect(output.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title,
          parent: parentId,
        }),
      ]),
    )
  }

  static expectNodeTitleContains(output, {substring, parentId}) {
    const matchingNode = output.nodes.find(node => node.parent === parentId && node.title.includes(substring))
    expect(matchingNode).toBeDefined()
    expect(matchingNode.title).toEqual(expect.stringContaining(substring))
  }

  static expectNodeCount(output, count) {
    expect(output.nodes).toHaveLength(count)
  }

  static expectAllParentsMatch(output, parentIds) {
    const actualParents = output.nodes.map(n => n.parent)
    parentIds.forEach(expectedParent => {
      expect(actualParents).toContain(expectedParent)
    })
  }
}
