FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8083
CMD ["npx", "expo", "start", "--port", "8083", "--host", "lan"]
