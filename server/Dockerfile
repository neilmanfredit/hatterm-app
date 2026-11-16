FROM golang:1.23-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /hattermserver ./cmd/hattermserver

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /hattermserver /hattermserver
VOLUME ["/var/lib/hattermserver"]
EXPOSE 8443
ENV HATTERM_DATA_DIR=/var/lib/hattermserver
ENTRYPOINT ["/hattermserver"]
