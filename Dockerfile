#Build stage
FROM node:22 AS build

WORKDIR /src

COPY package*.json .

RUN npm install \
    && npm install typescript -g

COPY . .

RUN npm run prod:build \
    && npm prune --omit=dev

#Production stage
FROM node:22 AS production

WORKDIR /src

COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist

CMD ["node", "dist/main.js"]
