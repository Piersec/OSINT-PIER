import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

loadEnvironment({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

const config = loadConfig();
const app = await createApp({ config });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
