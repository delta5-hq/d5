# dockerfile is use for building an image
FROM golang:1.25-alpine AS builder

# Move to working directory (/build).
WORKDIR /build

# Copy and download dependency using go mod.
COPY go.mod go.sum ./
RUN go mod download -x

# Copy the code into the container.
COPY . .

# Tidy dependencies before build
RUN go mod tidy

# Build the API server.
RUN go build -ldflags="-s -w" -o service .

FROM alpine:latest

RUN apk add --no-cache ca-certificates

WORKDIR /root/
COPY --from=builder /build/service .

EXPOSE 8080

ENTRYPOINT ["./service"]