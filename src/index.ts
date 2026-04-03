import { createApp } from "./app.js";
import { prisma } from "./shared/infrastructure/prisma/prisma-client.js";

const app = createApp(prisma);
const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`API em http://localhost:${port}`);
});
