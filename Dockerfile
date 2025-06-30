# Dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm ci
CMD ["node", "worker.js"]
