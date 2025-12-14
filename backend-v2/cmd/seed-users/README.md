# seed-users Tool

Centralized MongoDB seeding utility for E2E tests and development environments.

## Usage

```bash
# Basic seeding (no database drop)
./seed-users -uri="mongodb://localhost:27017/delta5-dev"

# Clean state seeding (drop database first)
./seed-users -uri="mongodb://localhost:27017/delta5" -drop
```

## Flags

- `-uri` (string): MongoDB connection URI (required)
- `-drop` (bool): Drop entire database before seeding (default: false)

## Integration

### Local Development (Makefile)
```makefile
seed-dev:
    @MONGO_PORT=27017 bash backend-v2/seed-e2e-users.sh

seed-e2e:
    @DROP_DB=true MONGO_PORT=27018 bash backend-v2/seed-e2e-users.sh
```

### CI Pipeline (GitLab CI)
```yaml
script:
  - go build -o seed-users ./cmd/seed-users/main.go
  - DROP_DB=true bash seed-e2e-users.sh
```

### Shell Wrapper (seed-e2e-users.sh)
```bash
DROP_DB=true bash backend-v2/seed-e2e-users.sh
```

## Seeded Users

| Username   | Password    | Roles                      | Workflow Limit | Node Limit |
|------------|-------------|----------------------------|----------------|------------|
| admin      | P@ssw0rd!   | subscriber, administrator  | Unlimited      | Unlimited  |
| subscriber | P@ssw0rd!   | subscriber                 | 10             | 300        |
| customer   | P@ssw0rd!   | customer                   | 5              | 100        |

## Architecture

**Centralized Pattern**: All pipelines use same seeding algorithm via `cmd/seed-users`
- Makefile → seed-e2e-users.sh → seed-users binary
- GitLab CI → seed-e2e-users.sh → seed-users binary
- Manual dev → seed-e2e-users.sh → seed-users binary

**Database Cleanup**: Controlled via `-drop` flag in seed-users binary
- E2E tests: Always drop (clean state guarantee)
- Dev environment: Never drop (preserves manual data)
- CI retries: Always drop (prevents accumulation)
