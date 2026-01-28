export const STROKE_ORDER_DETECTOR_CODE = `
const StrokeOrderDetector = {
  analyzeGroup(groupItems) {
    let fillIndex = -1;
    let strokeIndex = -1;

    for (let idx = 0; idx < groupItems.length; idx++) {
      const item = groupItems[idx];
      if ((item.ty === 'fl' || item.ty === 'gf') && fillIndex < 0) {
        fillIndex = idx;
      }
      if ((item.ty === 'st' || item.ty === 'gs') && strokeIndex < 0) {
        strokeIndex = idx;
      }
    }

    return {
      fillIndex,
      strokeIndex,
      strokeFirst: strokeIndex >= 0 && fillIndex >= 0 && strokeIndex > fillIndex
    };
  }
};
`;

/* Testable ES6 export */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/explicit-function-return-type */
export const StrokeOrderDetector = {
  analyzeGroup(groupItems: any[]) {
    let fillIndex = -1;
    let strokeIndex = -1;

    for (let idx = 0; idx < groupItems.length; idx++) {
      const item = groupItems[idx];
      if ((item.ty === 'fl' || item.ty === 'gf') && item.ix !== undefined) {
        fillIndex = item.ix;
      }
      if ((item.ty === 'st' || item.ty === 'gs') && item.ix !== undefined) {
        strokeIndex = item.ix;
      }
    }

    return {
      fillIndex,
      strokeIndex,
      strokeFirst: strokeIndex >= 0 && fillIndex >= 0 && strokeIndex < fillIndex
    };
  }
};
