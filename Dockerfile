# Debian trixie images: the prebuilt sqlite3 binaries need glibc >= 2.38, which bookworm
# (the default `node:22`) does not have, and compiling sqlite3 from source under QEMU for arm64
# is what made the CI build last 15-25 minutes.

#Build stage
# The compiled output is plain JS, so it runs once on the builder's native platform instead of
# once per target platform.
FROM --platform=$BUILDPLATFORM node:22-trixie AS build

WORKDIR /src

COPY package*.json ./

# tsc does not need the native sqlite3 / bcrypt binaries
RUN npm ci --ignore-scripts

COPY . .

RUN npm run prod:build

#Runtime dependencies stage, for the target platform
# sqlite3 and bcrypt download / ship prebuilt linux x64 and arm64 binaries: nothing is compiled.
FROM node:22-trixie AS deps

WORKDIR /src

COPY package*.json ./

RUN npm ci --omit=dev

#Production stage
FROM node:22-trixie-slim AS production

WORKDIR /src

COPY --from=deps /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist

# The git tag the image is built from (passed by the tag workflow), served by GET /version.
# Declared last so that a new version does not invalidate the cached layers above.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

CMD ["node", "dist/main.js"]
