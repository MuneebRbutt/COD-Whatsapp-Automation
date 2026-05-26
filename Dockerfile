# Stage 1: Build the React dashboard frontend
FROM node:18-alpine AS dashboard-builder
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# Stage 2: Create the runtime production image
FROM node:18-alpine AS runner
WORKDIR /app

# Install backend production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend source code
COPY . ./

# Copy built frontend assets from the builder stage
COPY --from=dashboard-builder /app/dashboard/dist ./dashboard/dist

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "src/server.js"]
