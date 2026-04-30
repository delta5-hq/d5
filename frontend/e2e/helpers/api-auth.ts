import type { APIRequestContext } from '@playwright/test'

export interface AuthCredentials {
  usernameOrEmail: string
  password: string
}

export interface AuthResult {
  ok: boolean
  status: number
  error?: string
  phase?: 'login' | 'refresh'
}

export async function authenticateViaAPI(
  requestContext: APIRequestContext,
  credentials: AuthCredentials,
): Promise<AuthResult> {
  const loginResponse = await requestContext.post('/api/v2/auth/login', {
    data: credentials,
  })

  if (!loginResponse.ok()) {
    return {
      ok: false,
      status: loginResponse.status(),
      error: `Login failed: ${loginResponse.status()}`,
      phase: 'login',
    }
  }

  const refreshResponse = await requestContext.post('/api/v2/auth/refresh')

  if (!refreshResponse.ok()) {
    return {
      ok: false,
      status: refreshResponse.status(),
      error: `Token refresh failed: ${refreshResponse.status()}`,
      phase: 'refresh',
    }
  }

  return {
    ok: true,
    status: refreshResponse.status(),
  }
}
