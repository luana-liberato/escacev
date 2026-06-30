import express from 'express';
import cors from 'cors';
import passport from 'passport';
import { routes } from './infra/http/routes';
import { errorHandler } from './infra/http/middlewares/errorHandler';
import { configureGoogleStrategy } from './infra/services/oauth';

export const app = express();

app.use(cors());
app.use(express.json());

// Autenticação Google OAuth (stateless — sem sessão de servidor).
configureGoogleStrategy();
app.use(passport.initialize());

app.use(routes);

// Middleware de erros — sempre por último.
app.use(errorHandler);
