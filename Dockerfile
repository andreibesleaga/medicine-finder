# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencie
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build args
ARG VITE_OPENROUTER_API_KEY
ARG VITE_OPENAI_API_KEY
ARG VITE_PERPLEXITY_API_KEY
ARG VITE_DEEPSEEK_API_KEY
ARG VITE_DRUGBANK_API_KEY
ARG VITE_CHEMSPIDER_API_KEY
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Build the application
RUN npm run build

# Production stage
FROM nginx:1.31.2-alpine3.23-slim

# Default port explicit
ENV PORT=80

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Add custom nginx config template for SPA routing
# Nginx docker image automatically enables envsubst for files in /etc/nginx/templates
RUN mkdir -p /etc/nginx/templates
RUN echo 'server { \
    listen ${PORT}; \
    location = /.well-known/sustainability-data { \
        root /usr/share/nginx/html; \
        default_type application/sustainability-data+json; \
        add_header Access-Control-Allow-Origin "*" always; \
        add_header Cache-Control "public, max-age=3600" always; \
        add_header X-Content-Type-Options "nosniff" always; \
        try_files $uri =404; \
    } \
    location /.well-known/ { \
        root /usr/share/nginx/html; \
        try_files $uri =404; \
    } \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
