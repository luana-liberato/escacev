import express from 'express';
import cors from 'cors';
import { routes } from './infra/http/routes';
import { errorHandler } from './infra/http/middlewares/errorHandler';

export const app = express();

app.use(cors());
app.use(express.json());

app.use(routes);

// Middleware de erros — sempre por último.
app.use(errorHandler);
