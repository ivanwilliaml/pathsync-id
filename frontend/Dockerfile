FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# rewrites are resolved at build time, so the backend address is a build argument
ARG PATHSYNC_API=http://backend:8000
ENV PATHSYNC_API=$PATHSYNC_API NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.mjs ./
EXPOSE 3000
CMD ["npm", "start"]
