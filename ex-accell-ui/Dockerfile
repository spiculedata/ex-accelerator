FROM node:25-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm ci --omit=dev

FROM node:25-slim

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "build"]
