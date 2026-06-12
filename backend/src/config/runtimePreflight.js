import {assertMockExternalServicesAllowed} from './mockExternalServices'

export const runRuntimePreflight = () => {
  assertMockExternalServicesAllowed()
}
