export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ApiError<T = unknown> extends Error {
  response?: {
    status?: number
    data?: T
    headers?: Record<string, string>
  }
}

export type ApiVersion = 'v1' | 'v2'
