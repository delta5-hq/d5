# Multi-stage build optimized for layer caching
FROM golang:1.25-alpine AS builder

WORKDIR /build

# Copy dependency files first (better cache utilization)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o service .

# Runtime stage - minimal image
FROM alpine:3.21

RUN apk add --no-cache ca-certificates=20250911-r0 tzdata=2025b-r0

WORKDIR /app
COPY --from=builder /build/service .

EXPOSE 3002

ENTRYPOINT ["./service"]
