import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import authRoutes from './modules/auth.routes.js';
import purchaseRoutes from './modules/purchases.routes.js';
import dashboardRoutes from './modules/dashboard.routes.js';
import documentsByIdRoutes from './modules/documents-by-id.routes.js';
import documentsListRoutes from './modules/documents-list.routes.js';
import warrantiesListRoutes from './modules/warranties-list.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import routes from './routes/index.js';

export const app = express();

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
app.use('/warranties', warrantiesListRoutes);
app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);
