import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import alertsListRoutes from './modules/alerts-list.routes.js';
import authRoutes from './modules/auth.routes.js';
import purchaseRoutes from './modules/purchases.routes.js';
import dashboardRoutes from './modules/dashboard.routes.js';
import documentsByIdRoutes from './modules/documents-by-id.routes.js';
import documentsListRoutes from './modules/documents-list.routes.js';
import nfeImportRoutes from './modules/nfe-import.routes.js';
import warrantiesListRoutes from './modules/warranties-list.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import routes from './routes/index.js';

export const app = express();

// Atrás do proxy reverso do Render (um único hop), o Express precisa confiar no
// primeiro proxy para resolver `request.ip` a partir do `X-Forwarded-For`. Sem
// isso, o express-rate-limit recusa o header e lança ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
// Em desenvolvimento local não há proxy, então mantemos o padrão (false).
app.set('trust proxy', env.nodeEnv === 'production' ? 1 : false);

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/purchases', purchaseRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/documents', documentsListRoutes);
app.use('/documents', documentsByIdRoutes);
app.use('/nfe', nfeImportRoutes);
app.use('/warranties', warrantiesListRoutes);
app.use('/alerts', alertsListRoutes);
app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);
