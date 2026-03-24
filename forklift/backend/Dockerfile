FROM node:18-alpine
WORKDIR /app

# Copy root package files (project uses root package.json)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy backend source
COPY backend/ ./backend/

ENV NODE_ENV=production
EXPOSE 5005
CMD ["node", "backend/server.js"]
