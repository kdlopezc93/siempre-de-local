import 'reflect-metadata';

import { createApp } from './app.factory.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';

const app = await createApp();
const env = app.get<Env>(ENV);
await app.listen({ port: env.PORT, host: '0.0.0.0' });
