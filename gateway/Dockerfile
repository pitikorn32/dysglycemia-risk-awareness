FROM node:24-alpine AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:1.28-alpine

COPY gateway/nginx.conf /etc/nginx/nginx.conf
COPY --from=frontend-build /build/dist /usr/share/nginx/html

EXPOSE 8080
