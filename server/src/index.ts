import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { GameManager } from './game/GameManager';
import { setupSocketHandlers } from './socket/handlers';
import { ClientToServerEvents, ServerToClientEvents } from './game/types';

const PORT = process.env.PORT || 3000;

// Create Express app
const app = express();
const httpServer = createServer(app);

// Create Socket.IO server
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST']
  }
});

// Serve static files from public directory
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Create game manager
const gameManager = new GameManager();

// Setup socket handlers
setupSocketHandlers(io, gameManager);

// Start server
const HOST = process.env.HOST || '127.0.0.1';

httpServer.listen(Number(PORT), HOST, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     Connect Four Multiplayer Server       ║
╠═══════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}  ║
║  Serving files from: ${publicPath.substring(0, 20)}...
╚═══════════════════════════════════════════╝
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
