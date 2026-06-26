// Intentional ESLint violation fixture — do NOT include in lint scope.
// Used only by eslint-no-restricted-version.test.ts to prove the
// no-restricted-syntax rule fires on hardcoded version/build strings in JSX.
export const HardcodedSemverInText = () => <div>1.2.3</div>
export const HardcodedDev = () => <span>dev</span>
export const HardcodedLocal = () => <span>local</span>
export const HardcodedUnknown = () => <span>unknown</span>
export const HardcodedVersionAttr = () => <input data-version="1.2.3" />
export const HardcodedSemverInExpr = () => <div>{'1.2.3'}</div>
export const HardcodedDevInExpr = () => <span>{'dev'}</span>
export const HardcodedLocalInExpr = () => <span>{'local'}</span>
export const HardcodedUnknownInExpr = () => <div>{'unknown'}</div>
