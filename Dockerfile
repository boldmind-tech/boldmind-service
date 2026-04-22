FROM node:22-alpine AS builder

RUN npm install -g pnpm@8.15.0

WORKDIR /

COPY /package.json ./


RUN cat package.json

RUN pnpm install --no-frozen-lockfile 


COPY / .

RUN npx prisma generate

RUN pnpm exec nest build

# ---- Production stage ----
FROM node:22-alpine

WORKDIR /service

COPY --from=builder  dist ./dist
COPY --from=builder /package.json ./package.json
COPY --from=builder /prisma ./prisma
COPY --from=builder /node_modules ./node_modules


RUN EXPOSE 4001

CMD ["node", "dist/main"]