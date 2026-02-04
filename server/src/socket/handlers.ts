import { Server, Socket } from 'socket.io';
import { GameManager } from '../game/GameManager';
import { ClientToServerEvents, ServerToClientEvents } from '../game/types';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function setupSocketHandlers(io: TypedServer, gameManager: GameManager): void {

  io.on('connection', (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send current lobby state on connection
    socket.emit('lobby-update', gameManager.getAvailableGames());

    // Join lobby with username
    socket.on('join-lobby', (username: string) => {
      const trimmedUsername = username.trim().substring(0, 20);
      if (!trimmedUsername) {
        socket.emit('error', 'Username is required');
        return;
      }

      gameManager.addPlayer(socket.id, trimmedUsername);
      console.log(`Player joined lobby: ${trimmedUsername} (${socket.id})`);

      // Send updated lobby to all clients
      io.emit('lobby-update', gameManager.getAvailableGames());
    });

    // Create a new game
    socket.on('create-game', () => {
      const player = gameManager.getPlayer(socket.id);
      if (!player) {
        socket.emit('error', 'Please enter a username first');
        return;
      }

      const game = gameManager.createGame(socket.id);
      if (!game) {
        socket.emit('error', 'Failed to create game');
        return;
      }

      // Join a socket room for this game
      socket.join(game.id);

      socket.emit('game-created', game.toState());
      socket.emit('player-number', 1);

      // Update lobby for all clients
      io.emit('lobby-update', gameManager.getAvailableGames());

      console.log(`Game created: ${game.id} by ${player.username}`);
    });

    // Join an existing game
    socket.on('join-game', (gameId: string) => {
      const player = gameManager.getPlayer(socket.id);
      if (!player) {
        socket.emit('error', 'Please enter a username first');
        return;
      }

      const game = gameManager.joinGame(gameId, socket.id);
      if (!game) {
        socket.emit('error', 'Unable to join game. It may be full or no longer available.');
        return;
      }

      // Join the socket room
      socket.join(game.id);

      // Notify the joining player
      socket.emit('game-joined', game.toState(), 2);
      socket.emit('player-number', 2);

      // Notify the host that someone joined
      const hostSocket = io.sockets.sockets.get(game.hostId);
      if (hostSocket) {
        hostSocket.emit('game-joined', game.toState(), 1);
      }

      // Update lobby for all clients
      io.emit('lobby-update', gameManager.getAvailableGames());

      console.log(`${player.username} joined game ${game.id}`);
    });

    // Make a move
    socket.on('make-move', (column: number) => {
      const result = gameManager.makeMove(socket.id, column);

      if (!result.game) {
        socket.emit('error', result.error || 'Unable to make move');
        return;
      }

      if (result.error) {
        socket.emit('error', result.error);
        return;
      }

      const game = result.game;
      const player = gameManager.getPlayer(socket.id);
      const playerNumber = game.getPlayerNumber(socket.id);

      // Broadcast move to both players
      io.to(game.id).emit('move-made', column, result.row!, playerNumber!);

      // Check if game is over
      if (game.status === 'finished') {
        io.to(game.id).emit('game-over', game.winner, game.winningCells);
        console.log(`Game ${game.id} finished. Winner: ${game.winner ? `Player ${game.winner}` : 'Draw'}`);
      }

      console.log(`Move made in game ${game.id}: column ${column} by ${player?.username}`);
    });

    // Leave current game
    socket.on('leave-game', () => {
      const game = gameManager.leaveGame(socket.id);

      if (game) {
        socket.leave(game.id);

        // Notify opponent
        const opponentId = game.hostId === socket.id ? game.guestId : game.hostId;
        if (opponentId) {
          const opponentSocket = io.sockets.sockets.get(opponentId);
          if (opponentSocket) {
            opponentSocket.emit('opponent-left');
          }
        }

        // Update lobby
        io.emit('lobby-update', gameManager.getAvailableGames());

        console.log(`Player left game ${game.id}`);
      }
    });

    // Request rematch
    socket.on('request-rematch', () => {
      const result = gameManager.requestRematch(socket.id);

      if (!result.game) {
        socket.emit('error', result.error || 'Unable to request rematch');
        return;
      }

      if (result.accepted) {
        // Both players agreed - start new game
        io.to(result.game.id).emit('rematch-accepted', result.game.toState());
        console.log(`Rematch started in game ${result.game.id}`);
      } else {
        // Notify opponent of rematch request
        const player = gameManager.getPlayer(socket.id);
        const game = result.game;
        const opponentId = game.hostId === socket.id ? game.guestId : game.hostId;

        if (opponentId && player) {
          const opponentSocket = io.sockets.sockets.get(opponentId);
          if (opponentSocket) {
            opponentSocket.emit('rematch-requested', player.username);
          }
        }

        console.log(`Rematch requested in game ${result.game.id} by ${player?.username}`);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const { player, game } = gameManager.removePlayer(socket.id);

      if (game && game.guestId) {
        // Notify opponent of disconnection
        const opponentId = game.hostId === socket.id ? game.guestId : game.hostId;
        if (opponentId) {
          const opponentSocket = io.sockets.sockets.get(opponentId);
          if (opponentSocket) {
            opponentSocket.emit('opponent-left');
          }
        }
      }

      // Update lobby
      io.emit('lobby-update', gameManager.getAvailableGames());

      console.log(`Client disconnected: ${socket.id}${player ? ` (${player.username})` : ''}`);
    });
  });

  // Cleanup old games periodically (every 5 minutes)
  setInterval(() => {
    const cleaned = gameManager.cleanupOldGames();
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old waiting games`);
      io.emit('lobby-update', gameManager.getAvailableGames());
    }
  }, 5 * 60 * 1000);
}
