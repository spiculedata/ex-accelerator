FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Install serve for production
RUN npm install -g serve

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

# Expose the port that SvelteKit will run on
EXPOSE 3000

# Start the application
CMD ["serve", "-s", "build", "-l", "3000"]