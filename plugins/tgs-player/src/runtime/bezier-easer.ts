/* MIT License - Gaëtan Renaudeau 2014-2015, adapted from lottie-web */
export const BEZIER_EASER_CODE = `
const BezierEaser = (function() {
  const NEWTON_ITERATIONS = 4;
  const NEWTON_MIN_SLOPE = 0.001;
  const SUBDIVISION_PRECISION = 0.0000001;
  const SUBDIVISION_MAX_ITERATIONS = 10;
  const K_SPLINE_TABLE_SIZE = 11;
  const K_SAMPLE_STEP_SIZE = 1.0 / (K_SPLINE_TABLE_SIZE - 1.0);

  function A(a1, a2) { return 1.0 - 3.0 * a2 + 3.0 * a1; }
  function B(a1, a2) { return 3.0 * a2 - 6.0 * a1; }
  function C(a1) { return 3.0 * a1; }

  function calcBezier(t, a1, a2) {
    return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  }

  function getSlope(t, a1, a2) {
    return 3.0 * A(a1, a2) * t * t + 2.0 * B(a1, a2) * t + C(a1);
  }

  function binarySubdivide(x, a, b, mX1, mX2) {
    let currentX, currentT, i = 0;
    do {
      currentT = a + (b - a) / 2.0;
      currentX = calcBezier(currentT, mX1, mX2) - x;
      if (currentX > 0.0) b = currentT;
      else a = currentT;
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  }

  function newtonRaphsonIterate(x, guessT, mX1, mX2) {
    for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
      const slope = getSlope(guessT, mX1, mX2);
      if (slope === 0.0) return guessT;
      const currentX = calcBezier(guessT, mX1, mX2) - x;
      guessT -= currentX / slope;
    }
    return guessT;
  }

  return function createBezierEaser(mX1, mY1, mX2, mY2) {
    const sampleValues = new Float32Array(K_SPLINE_TABLE_SIZE);
    for (let i = 0; i < K_SPLINE_TABLE_SIZE; ++i) {
      sampleValues[i] = calcBezier(i * K_SAMPLE_STEP_SIZE, mX1, mX2);
    }

    function getTForX(x) {
      let intervalStart = 0.0;
      let currentSample = 1;
      const lastSample = K_SPLINE_TABLE_SIZE - 1;

      for (; currentSample !== lastSample && sampleValues[currentSample] <= x; ++currentSample) {
        intervalStart += K_SAMPLE_STEP_SIZE;
      }
      --currentSample;

      const dist = (x - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
      const guessForT = intervalStart + dist * K_SAMPLE_STEP_SIZE;
      const initialSlope = getSlope(guessForT, mX1, mX2);

      if (initialSlope >= NEWTON_MIN_SLOPE) return newtonRaphsonIterate(x, guessForT, mX1, mX2);
      if (initialSlope === 0.0) return guessForT;
      return binarySubdivide(x, intervalStart, intervalStart + K_SAMPLE_STEP_SIZE, mX1, mX2);
    }

    return function(x) {
      if (mX1 === mY1 && mX2 === mY2) return x;
      if (x === 0) return 0;
      if (x === 1) return 1;
      return calcBezier(getTForX(x), mY1, mY2);
    };
  };
})();
`;
