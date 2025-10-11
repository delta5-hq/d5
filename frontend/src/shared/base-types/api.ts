export interface PaginationQuery {
  page?: number
  limit?: number
  search?: string
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
}

export interface Paginated<T> extends PaginationMeta {
  data: T[]
}

export interface ApiError<T = unknown> extends Error {
  response?: {
    status?: number
    data?: T
    headers?: Record<string, string>
  }
}
