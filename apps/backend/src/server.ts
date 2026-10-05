import './load-env.js';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import orderRouter from './routes/orders.js';
import drinkRouter from './routes/drinks.js';

const app = express();
const httpServer = createServer(app);
const frontendDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

// Configure WebSockets with explicit CORS permissions matching your frontend port
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173', // Your Vite client port
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Make Socket.io accessible anywhere across our express application router lifecycle
app.set('io', io);

// Handle WebSockets tracking (helpful for monitoring dashboard connections)
io.on('connection', (socket) => {
  console.log(`Live screen terminal linked: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Live screen terminal disconnected: ${socket.id}`);
  });
});

// Register routers
app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

app.use('/api', orderRouter);
app.use('/api', drinkRouter);

app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    return next();
  }
  return res.sendFile(resolve(frontendDist, 'index.html'));
});

const port = Number(process.env.PORT ?? 4000);
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Bar backend active on port ${port}`);
});
