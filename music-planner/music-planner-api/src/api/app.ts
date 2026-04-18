import express from 'express';
import cors from 'cors';
import { jwtCheck } from './middleware/auth';
import { extractClaims } from './middleware/claims';
import { errorHandler } from './middleware/errorHandler';
import { servicesRouter } from './routes/services';

const allowedOrigins = [
  'http://localhost:4200',
  ...(process.env['ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
];

const app = express();

app.use(cors({
  origin: allowedOrigins,
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  optionsSuccessStatus: 204,
}));

app.use(express.json());
app.use(jwtCheck);
app.use(extractClaims);
app.use('/api/services', servicesRouter);
app.use(errorHandler);

export { app };
