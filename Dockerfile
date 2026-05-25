# Dockerfile for Node.js backend
# ---------------------------------------------------
# Use the lightweight Alpine Linux image with Node.js 18
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install only production dependencies (but also dev for build)
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . ./

# Expose the port the app runs on
EXPOSE 3000

# Start the server
CMD ["node", "src/server.js"]
