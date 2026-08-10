FROM node:20-alpine AS admin-build
WORKDIR /admin
COPY admin/package.json admin/package-lock.json* ./
RUN npm install
COPY admin/ .
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=admin-build /admin/dist /usr/share/nginx/html/admin
EXPOSE 80
