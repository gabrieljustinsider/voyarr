FROM node:26-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Declare build arguments
ARG VITE_API_BASE

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine
LABEL version="1.188.0"
LABEL org.opencontainers.image.version="1.188.0"

# Copy built app
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80