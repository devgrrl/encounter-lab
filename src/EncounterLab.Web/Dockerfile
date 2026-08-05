FROM node:22.16.0-alpine3.21 AS build
WORKDIR /app
COPY src/EncounterLab.Web/package.json src/EncounterLab.Web/package-lock.json ./
RUN npm ci
COPY src/EncounterLab.Web/ ./
RUN npm run build

FROM nginx:1.29.3-alpine
COPY src/EncounterLab.Web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
