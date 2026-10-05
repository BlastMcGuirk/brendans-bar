import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
const { error } = config({ path: rootEnvPath });

if (error && error.code !== 'ENOENT') {
  throw error;
}
