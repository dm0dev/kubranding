# Headless logo generator for CI/CD (Node, no browser needed).
#
#   podman build -f Containerfile -t kubranding .
#   mkdir -p "$PWD/out" && podman run --rm \
#     --userns=keep-id --user "$(id -u):$(id -g)" \
#     -v "$PWD/out:/out:Z" kubranding --text "Acme\nCloud" --color EE0000 --out /out/logo.png
#   # Or pipe the PNG directly without bind mounts:
#   podman run --rm kubranding --text "Acme\nCloud" --color EE0000 --out - > logo.png
FROM quay.io/hummingbird/nodejs:24-builder AS builder

WORKDIR /app
COPY --chown=65532:65532 package.json package-lock.json ./
# Only runtime deps: @napi-rs/canvas (prebuilt binaries) + bundled fonts. No UI toolchain.
RUN npm ci --omit=dev --prefer-offline --no-audit --no-fund --cache /tmp/npm-cache

FROM quay.io/hummingbird/nodejs:24

LABEL org.opencontainers.image.title="KuBranding" \
      org.opencontainers.image.description="Headless icon + text logo generator CLI for CI/CD (Node.js, no browser needed)" \
      org.opencontainers.image.url="https://github.com/dm0dev/kubranding" \
      org.opencontainers.image.source="https://github.com/dm0dev/kubranding" \
      org.opencontainers.image.documentation="https://github.com/dm0dev/kubranding#readme" \
      org.opencontainers.image.authors="Daniel M. Gehrlein <dm0dev@proton.me>" \
      org.opencontainers.image.vendor="dm0dev" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app
COPY --chown=65532:65532 package.json ./
COPY --from=builder --chown=65532:65532 /app/node_modules ./node_modules
COPY --chown=65532:65532 src/core ./src/core
COPY --chown=65532:65532 src/node ./src/node
COPY --chown=65532:65532 src/cli ./src/cli
# Default icon used when --icon is omitted
COPY --chown=65532:65532 public/preset_logo.svg ./public/preset_logo.svg

ENTRYPOINT ["node", "src/cli/generate.ts"]
