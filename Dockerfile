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
FROM nginx:alpine

# Default port explicit
ENV PORT=80

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Add custom nginx config template for SPA routing
# Nginx docker image automatically enables envsubst for files in /etc/nginx/templates
RUN mkdir -p /etc/nginx/templates
RUN echo 'server { \
    listen ${PORT}; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
