# Simple production image for the IEMS dashboard backend
FROM node:20-slim

# better-sqlite3 needs build tools to compile its native binding
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# The SQLite file lives under db/ - mount a persistent volume here in production
# so the database survives deploys/restarts.
VOLUME ["/app/db"]

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
