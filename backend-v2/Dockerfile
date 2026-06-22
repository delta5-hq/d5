FROM golang:1.25-alpine AS builder
ARG BUILD_REVISION=dev

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w -X backend-v2/internal/config.BuildRevision=${BUILD_REVISION}" -o service . \
 && CGO_ENABLED=0 GOOS=linux go build -o seed-users ./cmd/seed-users

FROM alpine:3.21

# hadolint ignore=DL3018
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /build/service .

EXPOSE 3002

ENTRYPOINT ["./service"]
