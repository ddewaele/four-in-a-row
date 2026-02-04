import { Game } from './Game';
import { Player, LobbyGame } from './types';

export class GameManager {
  private games: Map<string, Game> = new Map();
  private players: Map<string, Player> = new Map();

  // Player management
  public addPlayer(socketId: string, username: string): Player {
    const player: Player = {
      id: socketId,
      username,
      gameId: null
    };
    this.players.set(socketId, player);
    return player;
  }

  public getPlayer(socketId: string): Player | undefined {
    return this.players.get(socketId);
  }

  public removePlayer(socketId: string): { player: Player | undefined; game: Game | undefined } {
    const player = this.players.get(socketId);
    let affectedGame: Game | undefined;

    if (player && player.gameId) {
      affectedGame = this.games.get(player.gameId);
      if (affectedGame) {
        affectedGame.handlePlayerLeave(socketId);

        // Remove game if it was waiting or both players left
        if (affectedGame.status === 'waiting' ||
            (affectedGame.hostId !== socketId && !this.players.has(affectedGame.hostId)) ||
            (affectedGame.guestId !== socketId && affectedGame.guestId && !this.players.has(affectedGame.guestId))) {
          // Keep game for the remaining player to see the result
        }

        // If host left while waiting, delete the game
        if (affectedGame.status === 'waiting') {
          this.games.delete(affectedGame.id);
        }
      }
    }

    this.players.delete(socketId);
    return { player, game: affectedGame };
  }

  // Game management
  public createGame(hostId: string): Game | null {
    const player = this.players.get(hostId);
    if (!player) return null;

    // Remove player from any existing game
    if (player.gameId) {
      this.leaveGame(hostId);
    }

    const game = new Game(hostId, player.username);
    this.games.set(game.id, game);
    player.gameId = game.id;

    return game;
  }

  public getGame(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  public joinGame(gameId: string, guestId: string): Game | null {
    const game = this.games.get(gameId);
    const player = this.players.get(guestId);

    if (!game || !player) return null;
    if (game.status !== 'waiting') return null;
    if (game.hostId === guestId) return null; // Can't join your own game

    // Remove player from any existing game
    if (player.gameId) {
      this.leaveGame(guestId);
    }

    game.addGuest(guestId, player.username);
    player.gameId = gameId;

    return game;
  }

  public leaveGame(playerId: string): Game | null {
    const player = this.players.get(playerId);
    if (!player || !player.gameId) return null;

    const game = this.games.get(player.gameId);
    if (!game) {
      player.gameId = null;
      return null;
    }

    game.handlePlayerLeave(playerId);
    player.gameId = null;

    // Remove game if it was in waiting state (host left)
    if (game.status === 'waiting') {
      this.games.delete(game.id);
    }

    return game;
  }

  public makeMove(playerId: string, column: number): { game: Game | null; row?: number; error?: string } {
    const player = this.players.get(playerId);
    if (!player || !player.gameId) {
      return { game: null, error: 'Not in a game' };
    }

    const game = this.games.get(player.gameId);
    if (!game) {
      return { game: null, error: 'Game not found' };
    }

    const result = game.makeMove(playerId, column);
    if (!result.success) {
      return { game, error: result.error };
    }

    return { game, row: result.row };
  }

  public requestRematch(playerId: string): { game: Game | null; accepted: boolean; error?: string } {
    const player = this.players.get(playerId);
    if (!player || !player.gameId) {
      return { game: null, accepted: false, error: 'Not in a game' };
    }

    const game = this.games.get(player.gameId);
    if (!game) {
      return { game: null, accepted: false, error: 'Game not found' };
    }

    if (game.status !== 'finished') {
      return { game, accepted: false, error: 'Game is not finished' };
    }

    // Check if other player already requested rematch
    if (game.rematchRequestedBy && game.rematchRequestedBy !== playerId) {
      // Both players want rematch - start new game
      game.resetForRematch();
      return { game, accepted: true };
    }

    // First rematch request
    game.rematchRequestedBy = playerId;
    return { game, accepted: false };
  }

  public getAvailableGames(): LobbyGame[] {
    const availableGames: LobbyGame[] = [];

    this.games.forEach(game => {
      if (game.status === 'waiting') {
        availableGames.push({
          id: game.id,
          hostUsername: game.hostUsername,
          createdAt: game.createdAt.toISOString()
        });
      }
    });

    // Sort by creation time (newest first)
    return availableGames.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getPlayerGame(playerId: string): Game | null {
    const player = this.players.get(playerId);
    if (!player || !player.gameId) return null;
    return this.games.get(player.gameId) || null;
  }

  // Cleanup old waiting games (optional, for maintenance)
  public cleanupOldGames(maxAgeMs: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    this.games.forEach((game, gameId) => {
      if (game.status === 'waiting' && now - game.createdAt.getTime() > maxAgeMs) {
        // Notify host if still connected
        const host = this.players.get(game.hostId);
        if (host) {
          host.gameId = null;
        }
        this.games.delete(gameId);
        cleaned++;
      }
    });

    return cleaned;
  }
}
