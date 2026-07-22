export function parseAadMigrationDeadline(rawValue) {
  if (!rawValue) return null

  const ts = Date.parse(rawValue)

  if (Number.isNaN(ts)) {
    throw new Error(`Invalid AAD_MIGRATION_DEADLINE: "${rawValue}" — must be an ISO-8601 date string`)
  }

  return ts
}

export function isDeadlineExceeded(deadlineMs) {
  return deadlineMs !== null && Date.now() > deadlineMs
}
