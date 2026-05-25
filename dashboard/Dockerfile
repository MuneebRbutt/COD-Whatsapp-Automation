# Dockerfile for React dashboard (frontend)
# ---------------------------------------------------
# Multi‑stage build: first compile the React app, then serve it with nginx

# ---------- Build stage ----------
FROM node:18-alpine AS build
WORKDIR /app

# Copy only package files to leverage Docker cache
COPY dashboard/package*.json ./
RUN npm ci

# Copy the whole dashboard source and build it
COPY dashboard/. ./
RUN npm run build   # assumes Vite build creates ./dist

# ---------- Runtime stage ----------
FROM nginx:alpine AS runtime
# Copy built assets into nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP port (default 80)
EXPOSE 80

# Use the default nginx command
CMD ["nginx", "-g", "daemon off;"]
