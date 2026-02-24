# ----------- Build stage -----------
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build-time arguments for Vite client variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Convert ARG -> ENV so Vite can read them during build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Build static files
RUN npm run build


# ----------- Production stage -----------
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
