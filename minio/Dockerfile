# Docker Hub and dl.min.io no longer serve the image/archive used by this lab.
FROM golang:1.24-alpine AS build
WORKDIR /src
ADD --checksum=sha256:484788a73bd0b93e1c99ca3e7b3c2584e9936986da857dca8a1d1a9fe4418d3b https://codeload.github.com/minio/minio/tar.gz/refs/tags/RELEASE.2025-02-07T23-21-09Z /tmp/minio.tar.gz
RUN tar -xzf /tmp/minio.tar.gz --strip-components=1 \
    && CGO_ENABLED=0 go build -trimpath \
       -ldflags='-s -w -X github.com/minio/minio/cmd.Version=2025-02-07T23:21:09Z -X github.com/minio/minio/cmd.ReleaseTag=RELEASE.2025-02-07T23-21-09Z' \
       -o /minio .

FROM alpine:3.22
RUN apk add --no-cache ca-certificates curl
COPY --from=build /minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /licenses/MINIO-LICENSE
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
