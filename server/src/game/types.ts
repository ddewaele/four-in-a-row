export interface Player {
  id: string;           // Socket ID
  username: string;
  gameId: string | null;
}

export type GameStatus = 'waiting' | 'playing' | 'finished';
export type PlayerNumber = 1 | 2;
export type CellValue = 0 | 1 | 2;

export interface GameState {
  id: string;
  hostId: string;
  hostUsername: string;
  guestId: string | null;
  guestUsername: string | null;
  board: CellValue[][];
  currentPlayer: PlayerNumber;
  status: GameStatus;
  winner: PlayerNumber | null;
  winningCells: [number, number][] | null;
  createdAt: Date;
  rematchRequestedBy: string | null;
}

// Client-to-Server events
export interface ClientToServerEvents {
  'join-lobby': (username: string) => void;
  'create-game': () => void;
  'join-game': (gameId: string) => void;
  'make-move': (column: number) => void;
  'leave-game': () => void;
  'request-rematch': () => void;
}

// Server-to-Client events
export interface ServerToClientEvents {
  'lobby-update': (games: LobbyGame[]) => void;
  'game-created': (game: GameState) => void;
  'game-joined': (game: GameState, playerNumber: PlayerNumber) => void;
  'game-state': (game: GameState) => void;
  'move-made': (column: number, row: number, player: PlayerNumber) => void;
  'game-over': (winner: PlayerNumber | null, winningCells: [number, number][] | null) => void;
  'opponent-left': () => void;
  'rematch-requested': (byUsername: string) => void;
  'rematch-accepted': (game: GameState) => void;
  'error': (message: string) => void;
  'player-number': (playerNumber: PlayerNumber) => void;
}

// Simplified game info for lobby display
export interface LobbyGame {
  id: string;
  hostUsername: string;
  createdAt: string;
}
