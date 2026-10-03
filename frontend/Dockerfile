# csmju-maintenance-request frontend — build จากรากของ repo:  docker build -f frontend/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter frontend...
COPY frontend frontend
# NEXT_PUBLIC_* ถูกฝังลงในหน้าเว็บตอน build · rewrites /api → backend ก็ถูกคำนวณตอน build เช่นกัน
ARG NEXT_PUBLIC_CORE_HUB_URL
ARG NEXT_PUBLIC_SUBSYSTEM_ID=csmju-maintenance-request
ARG BACKEND_URL=http://backend:4221
ENV NEXT_PUBLIC_CORE_HUB_URL=$NEXT_PUBLIC_CORE_HUB_URL \
    NEXT_PUBLIC_SUBSYSTEM_ID=$NEXT_PUBLIC_SUBSYSTEM_ID \
    BACKEND_URL=$BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter frontend build

FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3221 HOSTNAME=0.0.0.0
WORKDIR /app
# output: 'standalone' ของ workspace — server.js อยู่ใต้ frontend/ ส่วนไฟล์ static ต้องคัดลอกเอง
COPY --from=build --chown=node:node /repo/frontend/.next/standalone ./
COPY --from=build --chown=node:node /repo/frontend/.next/static ./frontend/.next/static
USER node
EXPOSE 3221
CMD ["node", "frontend/server.js"]
