FROM node:20-alpine

WORKDIR /app

# Install docker CLI for service management
RUN apk add --no-cache docker-cli curl

COPY package.json ./
RUN npm install --production

COPY server.js ./

EXPOSE 9090

CMD ["node", "server.js"]
