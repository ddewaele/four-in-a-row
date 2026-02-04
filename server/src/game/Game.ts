import { GameState, PlayerNumber, CellValue } from './types';

export class Game {
  private static readonly ROWS = 6;
  private static readonly COLS = 7;
  private static readonly CONNECT = 4;

  public readonly id: string;
  public hostId: string;
  public hostUsername: string;
  public guestId: string | null = null;
  public guestUsername: string | null = null;
  public board: CellValue[][];
  public currentPlayer: PlayerNumber = 1;
  public status: 'waiting' | 'playing' | 'finished' = 'waiting';
  public winner: PlayerNumber | null = null;
  public winningCells: [number, number][] | null = null;
  public createdAt: Date;
  public rematchRequestedBy: string | null = null;

  constructor(hostId: string, hostUsername: string) {
    this.id = this.generateGameId();
    this.hostId = hostId;
    this.hostUsername = hostUsername;
    this.board = this.createEmptyBoard();
    this.createdAt = new Date();
  }

  private generateGameId(): string {
    // Generate a short, readable game ID
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private createEmptyBoard(): CellValue[][] {
    return Array(Game.ROWS).fill(null).map(() =>
      Array(Game.COLS).fill(0) as CellValue[]
    );
  }

  public addGuest(guestId: string, guestUsername: string): void {
    this.guestId = guestId;
    this.guestUsername = guestUsername;
    this.status = 'playing';
  }

  public getPlayerNumber(playerId: string): PlayerNumber | null {
    if (playerId === this.hostId) return 1;
    if (playerId === this.guestId) return 2;
    return null;
  }

  public getPlayerId(playerNumber: PlayerNumber): string | null {
    if (playerNumber === 1) return this.hostId;
    if (playerNumber === 2) return this.guestId;
    return null;
  }

  public isPlayerTurn(playerId: string): boolean {
    const playerNumber = this.getPlayerNumber(playerId);
    return playerNumber === this.currentPlayer;
  }

  private getLowestEmptyRow(col: number): number {
    for (let row = Game.ROWS - 1; row >= 0; row--) {
      if (this.board[row][col] === 0) {
        return row;
      }
    }
    return -1; // Column is full
  }

  public makeMove(playerId: string, col: number): { success: boolean; row?: number; error?: string } {
    // Validate game status
    if (this.status !== 'playing') {
      return { success: false, error: 'Game is not in progress' };
    }

    // Validate player turn
    if (!this.isPlayerTurn(playerId)) {
      return { success: false, error: 'Not your turn' };
    }

    // Validate column
    if (col < 0 || col >= Game.COLS) {
      return { success: false, error: 'Invalid column' };
    }

    // Find lowest empty row
    const row = this.getLowestEmptyRow(col);
    if (row === -1) {
      return { success: false, error: 'Column is full' };
    }

    // Make the move
    this.board[row][col] = this.currentPlayer;

    // Check for win
    const winningCells = this.checkWin(row, col);
    if (winningCells) {
      this.winner = this.currentPlayer;
      this.winningCells = winningCells;
      this.status = 'finished';
      return { success: true, row };
    }

    // Check for draw
    if (this.checkDraw()) {
      this.status = 'finished';
      this.winner = null;
      return { success: true, row };
    }

    // Switch player
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;

    return { success: true, row };
  }

  private checkWin(row: number, col: number): [number, number][] | null {
    const player = this.board[row][col];
    const directions: [[number, number], [number, number]][] = [
      [[0, 1], [0, -1]],   // Horizontal
      [[1, 0], [-1, 0]],   // Vertical
      [[1, 1], [-1, -1]],  // Diagonal \
      [[1, -1], [-1, 1]]   // Diagonal /
    ];

    for (const [dir1, dir2] of directions) {
      const cells: [number, number][] = [[row, col]];

      // Check in first direction
      let r = row + dir1[0];
      let c = col + dir1[1];
      while (r >= 0 && r < Game.ROWS && c >= 0 && c < Game.COLS && this.board[r][c] === player) {
        cells.push([r, c]);
        r += dir1[0];
        c += dir1[1];
      }

      // Check in second direction
      r = row + dir2[0];
      c = col + dir2[1];
      while (r >= 0 && r < Game.ROWS && c >= 0 && c < Game.COLS && this.board[r][c] === player) {
        cells.push([r, c]);
        r += dir2[0];
        c += dir2[1];
      }

      if (cells.length >= Game.CONNECT) {
        return cells;
      }
    }

    return null;
  }

  private checkDraw(): boolean {
    return this.board[0].every(cell => cell !== 0);
  }

  public resetForRematch(): void {
    this.board = this.createEmptyBoard();
    this.currentPlayer = 1;
    this.status = 'playing';
    this.winner = null;
    this.winningCells = null;
    this.rematchRequestedBy = null;
  }

  public handlePlayerLeave(playerId: string): void {
    if (this.status === 'waiting') {
      // Host left while waiting - game will be deleted
      return;
    }

    // Mark game as finished if someone leaves during play
    if (this.status === 'playing') {
      this.status = 'finished';
      // The remaining player wins by forfeit
      const leavingPlayerNumber = this.getPlayerNumber(playerId);
      this.winner = leavingPlayerNumber === 1 ? 2 : 1;
    }
  }

  public toState(): GameState {
    return {
      id: this.id,
      hostId: this.hostId,
      hostUsername: this.hostUsername,
      guestId: this.guestId,
      guestUsername: this.guestUsername,
      board: this.board,
      currentPlayer: this.currentPlayer,
      status: this.status,
      winner: this.winner,
      winningCells: this.winningCells,
      createdAt: this.createdAt,
      rematchRequestedBy: this.rematchRequestedBy
    };
  }
}
