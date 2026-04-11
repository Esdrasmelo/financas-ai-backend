import { createApp } from "./app.js";
import { prisma } from "./shared/infrastructure/prisma/prisma-client.js";
import { logger } from "./shared/infrastructure/logger/logger.js";
import { createServer } from "node:http";

const app = createApp(prisma);
const port = Number(process.env.PORT) || 3001;
const env = process.env.NODE_ENV ?? "development";

const server = createServer(app);

const MAX_RETRIES = 8;
let retries = 0;

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE" && retries < MAX_RETRIES) {
    retries++;
    const delay = Math.min(500 * 2 ** (retries - 1), 5000);
    logger.warn(`Porta ${port} ocupada, tentativa ${retries}/${MAX_RETRIES} em ${delay}ms...`);
    setTimeout(() => server.listen(port), delay);
  } else {
    logger.error(`Falha ao iniciar: ${err.message}`);
    process.exit(1);
  }
});

server.on("listening", () => {
  logger.info(`Servidor iniciado`);
  logger.info(`Ambiente: ${env}`);
  logger.info(`Endereço: http://localhost:${port}`);
  logger.info(`Health:   http://localhost:${port}/health`);
});

server.listen(port);

function shutdown() {
  logger.info("Encerrando servidor...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
