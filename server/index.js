import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.routes.js';
import sessionRoutes from './routes/session.routes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
});

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/location-tracker';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

// In-memory room state
// rooms = { [code]: { senderSocket: socket.id, viewers: { [socket.id]: { id, name, email } } } }
const rooms = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-room', ({ code, role, user }) => {
    if (role === 'sender') {
      if (!rooms[code]) {
        rooms[code] = { senderSocket: socket.id, viewers: {} };
      } else {
        rooms[code].senderSocket = socket.id;
      }
      socket.join(code);
      console.log(`Sender ${user.name} joined room ${code}`);
    } else if (role === 'viewer') {
      if (!rooms[code]) {
        return socket.emit('error', { message: 'Session is not active yet.' });
      }
      rooms[code].viewers[socket.id] = user;
      socket.join(code);
      console.log(`Viewer ${user.name} joined room ${code}`);

      // Notify sender about new viewer
      if (rooms[code].senderSocket) {
        io.to(rooms[code].senderSocket).emit('viewer-list', Object.values(rooms[code].viewers));
        io.to(rooms[code].senderSocket).emit('viewer-joined', user);
      }
    }
  });

  socket.on('send-location', ({ code, coordinates }) => {
    // Forward location to all viewers in the room (except sender)
    socket.to(code).emit('receive-location', coordinates);
  });

  socket.on('stop-session', ({ code }) => {
    if (rooms[code] && rooms[code].senderSocket === socket.id) {
      socket.to(code).emit('session-ended');
      delete rooms[code];
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Find if user was sender or viewer in any room
    for (const code in rooms) {
      if (rooms[code].senderSocket === socket.id) {
        // Sender disconnected
        socket.to(code).emit('session-ended');
        delete rooms[code];
      } else if (rooms[code].viewers[socket.id]) {
        // Viewer disconnected
        const viewer = rooms[code].viewers[socket.id];
        delete rooms[code].viewers[socket.id];
        if (rooms[code].senderSocket) {
          io.to(rooms[code].senderSocket).emit('viewer-list', Object.values(rooms[code].viewers));
          io.to(rooms[code].senderSocket).emit('viewer-left', viewer);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
