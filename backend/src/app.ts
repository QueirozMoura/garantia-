import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import routes from './routes/index.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);
