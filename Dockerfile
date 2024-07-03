#Build stage
FROM node:20 AS build

WORKDIR /src

COPY package*.json .

RUN npm install

COPY . .

RUN npm run prod:build

#Production stage
FROM node:20 AS production

WORKDIR /src

COPY package*.json .
COPY .env .

RUN npm ci --only=production

COPY --from=build /src/dist ./dist

CMD ["node", "dist/main.js"]
