FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8082
CMD ["npx", "expo", "start", "--port", "8082", "--host", "lan"]
