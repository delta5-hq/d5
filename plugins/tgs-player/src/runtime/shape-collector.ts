export const SHAPE_COLLECTOR_CODE = `
const ShapeCollector = {
  extractFromGroup(groupItems) {
    const pathShapes = [];
    let fillShape = null;
    let gradientFillShape = null;
    const strokeShapes = [];
    let transformShape = null;
    const trimShapes = [];
    let mergeShape = null;

    for (const item of groupItems) {
      switch (item.ty) {
        case 'sh': pathShapes.push(item); break;
        case 'fl': fillShape = item; break;
        case 'gf': gradientFillShape = item; break;
        case 'st': strokeShapes.push(item); break;
        case 'tr': transformShape = item; break;
        case 'tm': trimShapes.push(item); break;
        case 'mm': mergeShape = item; break;
      }
    }

    return {
      pathShapes,
      fillShape,
      gradientFillShape,
      strokeShapes,
      transformShape,
      trimShapes,
      mergeShape
    };
  },

  extractLayerLevel(layerShapes) {
    return {
      trimShapes: layerShapes.filter(s => s.ty === 'tm'),
      fillShape: layerShapes.find(s => s.ty === 'fl'),
      strokeShape: layerShapes.find(s => s.ty === 'st'),
      gradientFillShape: layerShapes.find(s => s.ty === 'gf')
    };
  },

  mergeWithLayerDefaults(groupShapes, layerShapes) {
    return {
      ...groupShapes,
      fillShape: groupShapes.fillShape || layerShapes.fillShape,
      gradientFillShape: groupShapes.gradientFillShape || layerShapes.gradientFillShape,
      strokeShapes: groupShapes.strokeShapes.length > 0 ? groupShapes.strokeShapes : 
        (layerShapes.strokeShape ? [layerShapes.strokeShape] : []),
      trimShapes: [...(layerShapes.trimShapes || []), ...groupShapes.trimShapes]
    };
  }
};
`;

/* Testable ES6 exports */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/explicit-function-return-type */
export const ShapeCollector = {
  extractFromGroup(group: any) {
    const paths: any[] = [];
    let fill: any = null;
    let stroke: any = null;
    let trimPath: any = null;
    let gradientFill: any = null;
    let gradientStroke: any = null;

    if (!group.it) {
      return { paths, fill, stroke, trimPath, gradientFill, gradientStroke };
    }

    for (const item of group.it) {
      if (item.ty === 'sh') {
        paths.push(item.ks.k);
      } else if (item.ty === 'rc') {
        paths.push(item);
      } else if (item.ty === 'el') {
        paths.push(item);
      } else if (item.ty === 'fl') {
        fill = item;
      } else if (item.ty === 'st') {
        stroke = item;
      } else if (item.ty === 'tm') {
        trimPath = item;
      } else if (item.ty === 'gf') {
        gradientFill = item;
      } else if (item.ty === 'gs') {
        gradientStroke = item;
      }
    }

    return { paths, fill, stroke, trimPath, gradientFill, gradientStroke };
  },

  extractLayerLevel(shapes: any[]) {
    let fill: any = null;
    let stroke: any = null;
    let trimPath: any = null;
    let gradientFill: any = null;
    let gradientStroke: any = null;

    for (const shape of shapes) {
      if (shape.ty === 'gr') continue;
      
      if (shape.ty === 'fl') fill = shape;
      else if (shape.ty === 'st') stroke = shape;
      else if (shape.ty === 'tm') trimPath = shape;
      else if (shape.ty === 'gf') gradientFill = shape;
      else if (shape.ty === 'gs') gradientStroke = shape;
    }

    return { fill, stroke, trimPath, gradientFill, gradientStroke };
  },

  mergeWithLayerDefaults(groupShapes: any, layerDefaults: any) {
    return {
      paths: groupShapes.paths,
      fill: groupShapes.fill || layerDefaults.fill,
      stroke: groupShapes.stroke || layerDefaults.stroke,
      trimPath: groupShapes.trimPath || layerDefaults.trimPath,
      gradientFill: groupShapes.gradientFill || layerDefaults.gradientFill,
      gradientStroke: groupShapes.gradientStroke || layerDefaults.gradientStroke
    };
  }
};
