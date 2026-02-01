export const PATH_ELEMENT_FACTORY_CODE = `
const PathElementFactory = {
  createFillPath(parentGroup, gradientId) {
    const element = SvgBuilder.createPath();
    if (gradientId) {
      element.setAttribute('fill', 'url(#' + gradientId + ')');
    }
    parentGroup.appendChild(element);
    return element;
  },

  createStrokePath(parentGroup) {
    const element = SvgBuilder.createPath();
    parentGroup.appendChild(element);
    return element;
  },

  createEmptyPath(parentGroup) {
    const element = SvgBuilder.createPath();
    parentGroup.appendChild(element);
    return element;
  },

  createPathDescriptor(element, group, shapes, isMerged) {
    return {
      element,
      group,
      pathShape: isMerged ? undefined : shapes.pathShape,
      pathShapes: isMerged ? shapes.pathShapes : undefined,
      fillShape: shapes.fillShape,
      gradientFillShape: shapes.gradientFillShape,
      gradientElement: shapes.gradientElement,
      strokeShape: shapes.strokeShape,
      transformShape: shapes.transformShape,
      trimShapes: shapes.trimShapes,
      merged: isMerged
    };
  }
};
`;
