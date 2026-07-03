FROM node:22-alpine

WORKDIR /app
RUN chown node:node /app
USER node

ENV EXPO_NO_TELEMETRY=1

COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 8081

CMD ["npx", "expo", "start", "--host", "lan", "--port", "8081"]
