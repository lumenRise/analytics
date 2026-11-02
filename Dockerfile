FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN npm install --global serve@14.2.4
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3002
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:3002"]
