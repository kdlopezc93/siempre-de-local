# syntax=docker/dockerfile:1
# Imagen del API (NestJS) para Fly.io. Se construye desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile -t sdl-api .

FROM node:24.22.0-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter "@sdl/api..."
# contracts y domain se importan desde su dist en producción.
RUN pnpm --filter "@sdl/api..." build
# node_modules solo de producción, con los paquetes del workspace ya compilados.
RUN pnpm --filter @sdl/api deploy --prod --legacy /out

FROM node:24.22.0-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
