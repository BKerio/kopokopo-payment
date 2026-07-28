import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import mpesaRoutes from '@/routes/mpesa';
import kopokopoRoutes from '@/routes/kopokopo';

const app = express();

// Allow multiple client origins (Vite can spin up on 5173 or 5174)
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map((o) => o.trim());

// HTTP server and Socket.IO setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Expose io to routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // M-Pesa Daraja: join room by CheckoutRequestID
  socket.on('join_checkout', ({ checkoutRequestId }: { checkoutRequestId: string }) => {
    if (checkoutRequestId) {
      socket.join(checkoutRequestId);
      console.log(`Socket ${socket.id} joined Daraja room ${checkoutRequestId}`);
    }
  });

  // Kopokopo: join room by payment location URL
  socket.on('join_kopokopo', ({ location }: { location: string }) => {
    if (location) {
      socket.join(location);
      console.log(`Socket ${socket.id} joined Kopokopo room ${location}`);
    }
  });

  socket.on('disconnect', (reason: string) => {
    console.log('Socket disconnected:', socket.id, reason);
  });
});

// Middleware
app.use(cors({
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  credentials: true,
}));
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Routes
app.get('/', (req, res) => {
  res.send('M-Pesa Backend is running!');
});
app.use('/api', mpesaRoutes);
app.use('/api/kopokopo', kopokopoRoutes);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => {
    console.log('MongoDB connected.');
  })
  .catch((err: Error) => {
    console.error('MongoDB connection error:', err);
  });

// Server listen
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('=========================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`M-Pesa Callback URL: ${process.env.MPESA_CALLBACK_URL}`);
  console.log(`Kopokopo Callback URL: ${process.env.KOPOKOPO_CALLBACK_URL}`);
  console.log(`Kopokopo Base URL: ${process.env.KOPOKOPO_BASE_URL}`);
  console.log(`Client Origin(s): ${allowedOrigins.join(', ')}`);
  console.log('=========================================');
});
