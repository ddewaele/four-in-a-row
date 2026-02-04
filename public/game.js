/**
 * Connect Four Game
 * Supports both local 2-player and online multiplayer modes
 */

class ConnectFourApp {
    constructor() {
        // Screens
        this.screens = {
            mainMenu: document.getElementById('main-menu-screen'),
            login: document.getElementById('login-screen'),
            lobby: document.getElementById('lobby-screen'),
            waiting: document.getElementById('waiting-screen'),
            game: document.getElementById('game-screen')
        };

        // Mode
        this.mode = null; // 'local' or 'online'
        this.username = '';

        // Socket.IO
        this.socket = null;
        this.playerNumber = null;
        this.currentGameId = null;
        this.opponentUsername = null;
        this.rematchRequested = false;

        // Game instance
        this.game = null;

        this.init();
    }

    init() {
        this.bindMenuEvents();
        this.showScreen('mainMenu');
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
        }
    }

    bindMenuEvents() {
        // Main Menu
        document.getElementById('btn-local-game').addEventListener('click', () => {
            this.startLocalGame();
        });

        document.getElementById('btn-online-game').addEventListener('click', () => {
            this.showScreen('login');
        });

        // Login Screen
        document.getElementById('btn-back-to-menu').addEventListener('click', () => {
            this.showScreen('mainMenu');
        });

        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('username-input');
            this.username = usernameInput.value.trim();
            if (this.username) {
                this.connectToServer();
            }
        });

        // Lobby Screen
        document.getElementById('btn-back-to-login').addEventListener('click', () => {
            this.disconnectFromServer();
            this.showScreen('login');
        });

        document.getElementById('btn-create-game').addEventListener('click', () => {
            this.createOnlineGame();
        });

        // Waiting Screen
        document.getElementById('btn-cancel-waiting').addEventListener('click', () => {
            this.leaveGame();
            this.showScreen('lobby');
        });

        document.getElementById('btn-copy-code').addEventListener('click', () => {
            this.copyGameCode();
        });

        // Game Screen - Leave button
        document.getElementById('btn-leave-game').addEventListener('click', () => {
            this.handleLeaveGame();
        });

        // Game Screen - Leave after win/draw
        document.getElementById('btn-leave-after-win').addEventListener('click', () => {
            document.getElementById('win-overlay').classList.remove('active');
            this.handleLeaveGame();
        });

        document.getElementById('btn-leave-after-draw').addEventListener('click', () => {
            document.getElementById('draw-overlay').classList.remove('active');
            this.handleLeaveGame();
        });

        // Rematch buttons
        document.getElementById('btn-accept-rematch').addEventListener('click', () => {
            this.acceptRematch();
        });

        document.getElementById('btn-decline-rematch').addEventListener('click', () => {
            this.declineRematch();
        });

        // Opponent left
        document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
            document.getElementById('opponent-left-overlay').classList.remove('active');
            if (this.mode === 'online') {
                this.showScreen('lobby');
            } else {
                this.showScreen('mainMenu');
            }
        });
    }

    // =====================================================
    // LOCAL GAME MODE
    // =====================================================

    startLocalGame() {
        this.mode = 'local';
        this.screens.game.classList.add('local-mode');
        this.screens.game.classList.remove('online-mode');

        // Set player names
        document.getElementById('player-1-name').textContent = 'Player 1';
        document.getElementById('player-2-name').textContent = 'Player 2';

        this.showScreen('game');
        this.game = new ConnectFour(this, 'local');
    }

    // =====================================================
    // ONLINE GAME MODE
    // =====================================================

    connectToServer() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
            this.socket.emit('join-lobby', this.username);
            document.getElementById('display-username').textContent = this.username;
            this.showScreen('lobby');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('error', (message) => {
            console.error('Server error:', message);
            alert(message);
        });

        this.socket.on('lobby-update', (games) => {
            this.updateLobbyList(games);
        });

        this.socket.on('game-created', (gameState) => {
            this.currentGameId = gameState.id;
            document.getElementById('game-code').textContent = gameState.id;
            this.showScreen('waiting');
        });

        this.socket.on('player-number', (playerNumber) => {
            this.playerNumber = playerNumber;
        });

        this.socket.on('game-joined', (gameState, playerNumber) => {
            this.currentGameId = gameState.id;
            this.playerNumber = playerNumber;
            this.startOnlineGame(gameState);
        });

        this.socket.on('move-made', (column, row, player) => {
            if (this.game) {
                this.game.handleRemoteMove(column, row, player);
            }
        });

        this.socket.on('game-over', (winner, winningCells) => {
            if (this.game) {
                this.game.handleRemoteGameOver(winner, winningCells);
            }
        });

        this.socket.on('opponent-left', () => {
            if (this.game) {
                this.game.handleOpponentLeft();
            }
        });

        this.socket.on('rematch-requested', (byUsername) => {
            if (this.game) {
                this.game.showRematchRequest(byUsername);
            }
        });

        this.socket.on('rematch-accepted', (gameState) => {
            if (this.game) {
                this.game.startRematch(gameState);
            }
        });
    }

    disconnectFromServer() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        const statusText = statusElement.querySelector('.status-text');

        if (connected) {
            statusElement.classList.remove('disconnected');
            statusText.textContent = 'Connected';
        } else {
            statusElement.classList.add('disconnected');
            statusText.textContent = 'Disconnected';
        }
    }

    updateLobbyList(games) {
        const listElement = document.getElementById('games-list');
        const emptyElement = document.getElementById('games-empty');

        // Clear existing game items (keep empty state)
        listElement.querySelectorAll('.game-item').forEach(item => item.remove());

        if (games.length === 0) {
            emptyElement.style.display = 'block';
        } else {
            emptyElement.style.display = 'none';

            games.forEach(game => {
                const gameItem = document.createElement('div');
                gameItem.className = 'game-item';
                gameItem.innerHTML = `
                    <div class="game-item-info">
                        <span class="game-item-host">${this.escapeHtml(game.hostUsername)}</span>
                        <span class="game-item-code">Game: ${game.id}</span>
                    </div>
                    <button class="btn btn-join" data-game-id="${game.id}">Join</button>
                `;

                const joinBtn = gameItem.querySelector('.btn-join');
                joinBtn.addEventListener('click', () => {
                    this.joinOnlineGame(game.id);
                });

                listElement.appendChild(gameItem);
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    createOnlineGame() {
        if (this.socket) {
            this.socket.emit('create-game');
        }
    }

    joinOnlineGame(gameId) {
        if (this.socket) {
            this.socket.emit('join-game', gameId);
        }
    }

    startOnlineGame(gameState) {
        this.mode = 'online';
        this.screens.game.classList.remove('local-mode');
        this.screens.game.classList.add('online-mode');

        // Set player names
        const isHost = this.playerNumber === 1;
        this.opponentUsername = isHost ? gameState.guestUsername : gameState.hostUsername;

        document.getElementById('player-1-name').textContent = isHost ? 'You' : this.opponentUsername;
        document.getElementById('player-2-name').textContent = isHost ? this.opponentUsername : 'You';

        this.showScreen('game');
        this.game = new ConnectFour(this, 'online', gameState);
    }

    leaveGame() {
        if (this.socket && this.currentGameId) {
            this.socket.emit('leave-game');
            this.currentGameId = null;
        }
    }

    copyGameCode() {
        const code = document.getElementById('game-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('btn-copy-code');
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;
            setTimeout(() => {
                btn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                `;
            }, 2000);
        });
    }

    handleLeaveGame() {
        if (this.mode === 'online') {
            this.leaveGame();
            this.showScreen('lobby');
        } else {
            this.showScreen('mainMenu');
        }
        this.game = null;
    }

    sendMove(column) {
        if (this.socket && this.mode === 'online') {
            this.socket.emit('make-move', column);
        }
    }

    requestRematch() {
        if (this.socket && this.mode === 'online') {
            this.socket.emit('request-rematch');
            this.rematchRequested = true;
        }
    }

    acceptRematch() {
        document.getElementById('rematch-overlay').classList.remove('active');
        this.requestRematch();
    }

    declineRematch() {
        document.getElementById('rematch-overlay').classList.remove('active');
        this.handleLeaveGame();
    }
}

/**
 * Connect Four Game Logic
 */
class ConnectFour {
    constructor(app, mode, initialState = null) {
        this.app = app;
        this.mode = mode; // 'local' or 'online'

        this.ROWS = 6;
        this.COLS = 7;
        this.CONNECT = 4;

        // Game state
        this.board = [];
        this.currentPlayer = 1;
        this.gameOver = false;
        this.scores = { 1: 0, 2: 0 };
        this.isAnimating = false;

        // DOM Elements
        this.boardElement = document.getElementById('game-board');
        this.columnIndicators = document.getElementById('column-indicators');
        this.turnChip = document.getElementById('turn-chip');
        this.turnText = document.getElementById('turn-text');
        this.turnIndicator = document.querySelector('.turn-indicator');
        this.winOverlay = document.getElementById('win-overlay');
        this.drawOverlay = document.getElementById('draw-overlay');
        this.winChip = document.getElementById('win-chip');
        this.winTitle = document.getElementById('win-title');
        this.resetBtn = document.getElementById('reset-btn');
        this.resetScoresBtn = document.getElementById('reset-scores-btn');
        this.playAgainBtn = document.getElementById('play-again-btn');
        this.drawPlayAgainBtn = document.getElementById('draw-play-again-btn');
        this.score1Element = document.getElementById('score-1');
        this.score2Element = document.getElementById('score-2');
        this.rematchOverlay = document.getElementById('rematch-overlay');
        this.opponentLeftOverlay = document.getElementById('opponent-left-overlay');

        if (initialState) {
            this.initFromState(initialState);
        } else {
            this.init();
        }
    }

    init() {
        if (this.mode === 'local') {
            this.loadScores();
        } else {
            this.scores = { 1: 0, 2: 0 };
        }

        this.createBoard();
        this.createColumnIndicators();
        this.bindEvents();
        this.updateTurnIndicator();
        this.updateScoreDisplay();
        this.updateBoardInteractivity();

        // Add loading animation
        this.boardElement.classList.add('loading');
        setTimeout(() => {
            this.boardElement.classList.remove('loading');
        }, 1000);
    }

    initFromState(state) {
        this.board = state.board;
        this.currentPlayer = state.currentPlayer;
        this.gameOver = state.status === 'finished';
        this.scores = { 1: 0, 2: 0 };

        this.renderBoard();
        this.createColumnIndicators();
        this.bindEvents();
        this.updateTurnIndicator();
        this.updateScoreDisplay();
        this.updateBoardInteractivity();
    }

    createBoard() {
        this.board = Array(this.ROWS).fill(null).map(() => Array(this.COLS).fill(0));
        this.renderBoard();
    }

    renderBoard() {
        this.boardElement.innerHTML = '';

        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                // Add existing piece if any
                if (this.board[row][col] !== 0) {
                    const piece = document.createElement('div');
                    piece.className = `piece ${this.board[row][col] === 1 ? 'red' : 'yellow'}`;
                    cell.appendChild(piece);
                }

                this.boardElement.appendChild(cell);
            }
        }
    }

    createColumnIndicators() {
        this.columnIndicators.innerHTML = '';

        for (let col = 0; col < this.COLS; col++) {
            const indicator = document.createElement('div');
            indicator.className = 'column-indicator';
            indicator.dataset.col = col;
            indicator.innerHTML = '<div class="indicator-arrow"></div>';
            this.columnIndicators.appendChild(indicator);
        }
    }

    bindEvents() {
        // Click on cells
        this.boardElement.addEventListener('click', (e) => {
            const cell = e.target.closest('.cell');
            if (cell && !this.gameOver && !this.isAnimating && this.canMakeMove()) {
                const col = parseInt(cell.dataset.col);
                this.handleMove(col);
            }
        });

        // Click on column indicators
        this.columnIndicators.addEventListener('click', (e) => {
            const indicator = e.target.closest('.column-indicator');
            if (indicator && !this.gameOver && !this.isAnimating && this.canMakeMove()) {
                const col = parseInt(indicator.dataset.col);
                this.handleMove(col);
            }
        });

        // Touch events for mobile - prevent scrolling on board
        this.boardElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });

        // Reset game button
        this.resetBtn.addEventListener('click', () => this.handleResetClick());

        // Reset scores button
        this.resetScoresBtn.addEventListener('click', () => this.resetScores());

        // Play again buttons
        this.playAgainBtn.addEventListener('click', () => {
            this.winOverlay.classList.remove('active');
            this.handlePlayAgain();
        });

        this.drawPlayAgainBtn.addEventListener('click', () => {
            this.drawOverlay.classList.remove('active');
            this.handlePlayAgain();
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (!this.app.screens.game.classList.contains('active')) return;

            if (e.key >= '1' && e.key <= '7' && !this.gameOver && !this.isAnimating && this.canMakeMove()) {
                const col = parseInt(e.key) - 1;
                this.handleMove(col);
            } else if ((e.key === 'r' || e.key === 'R') && this.mode === 'local') {
                if (this.winOverlay.classList.contains('active')) {
                    this.winOverlay.classList.remove('active');
                }
                if (this.drawOverlay.classList.contains('active')) {
                    this.drawOverlay.classList.remove('active');
                }
                this.resetGame();
            }
        });
    }

    canMakeMove() {
        if (this.mode === 'local') {
            return true;
        }
        // Online mode - only can move on your turn
        return this.currentPlayer === this.app.playerNumber;
    }

    handleMove(col) {
        const row = this.getLowestEmptyRow(col);
        if (row === -1) return; // Column is full

        if (this.mode === 'online') {
            // Send move to server, server will validate and broadcast
            this.app.sendMove(col);
        } else {
            // Local mode - process immediately
            this.dropPiece(col, row, this.currentPlayer);
        }
    }

    handleResetClick() {
        if (this.mode === 'local') {
            this.resetGame();
        } else {
            // Online mode - request rematch
            this.app.requestRematch();
        }
    }

    handlePlayAgain() {
        if (this.mode === 'local') {
            this.resetGame();
        } else {
            // Online mode - request rematch
            this.app.requestRematch();
        }
    }

    // Called when server broadcasts a move (for online mode)
    handleRemoteMove(column, row, player) {
        // Update internal state
        this.currentPlayer = player;
        this.dropPiece(column, row, player, true);
    }

    // Called when server broadcasts game over
    handleRemoteGameOver(winner, winningCells) {
        this.gameOver = true;

        if (winner) {
            this.scores[winner]++;
            this.updateScoreDisplay();

            // Highlight winning pieces
            if (winningCells) {
                winningCells.forEach(([row, col]) => {
                    const cellIndex = row * this.COLS + col;
                    const cell = this.boardElement.children[cellIndex];
                    const piece = cell.querySelector('.piece');
                    if (piece) {
                        piece.classList.add('winning');
                    }
                });
            }

            // Disable all cells
            this.boardElement.querySelectorAll('.cell').forEach(cell => {
                cell.classList.add('disabled');
            });

            // Show win overlay
            setTimeout(() => {
                this.winChip.className = `win-chip ${winner === 1 ? 'red' : 'yellow'}`;

                // Show appropriate message
                if (this.mode === 'online') {
                    const isWinner = winner === this.app.playerNumber;
                    this.winTitle.textContent = isWinner ? 'You Win!' : `${this.app.opponentUsername} Wins!`;
                } else {
                    this.winTitle.textContent = `Player ${winner} Wins!`;
                }

                this.winOverlay.classList.add('active');
                this.playWinSound();
            }, 800);
        } else {
            // Draw
            this.boardElement.querySelectorAll('.cell').forEach(cell => {
                cell.classList.add('disabled');
            });

            setTimeout(() => {
                this.drawOverlay.classList.add('active');
            }, 500);
        }
    }

    handleOpponentLeft() {
        this.gameOver = true;
        this.opponentLeftOverlay.classList.add('active');
    }

    showRematchRequest(byUsername) {
        document.getElementById('rematch-subtitle').textContent = `${byUsername} wants a rematch!`;
        this.rematchOverlay.classList.add('active');
    }

    startRematch(gameState) {
        this.rematchOverlay.classList.remove('active');
        this.winOverlay.classList.remove('active');
        this.drawOverlay.classList.remove('active');

        this.board = gameState.board;
        this.currentPlayer = gameState.currentPlayer;
        this.gameOver = false;
        this.isAnimating = false;

        this.renderBoard();
        this.updateTurnIndicator();
        this.updateColumnIndicators();
        this.updateBoardInteractivity();

        // Add loading animation
        this.boardElement.classList.add('loading');
        setTimeout(() => {
            this.boardElement.classList.remove('loading');
        }, 1000);
    }

    getLowestEmptyRow(col) {
        for (let row = this.ROWS - 1; row >= 0; row--) {
            if (this.board[row][col] === 0) {
                return row;
            }
        }
        return -1; // Column is full
    }

    async dropPiece(col, row, player, isRemote = false) {
        this.isAnimating = true;

        // Update board state
        this.board[row][col] = player;

        // Get the cell and add the piece with animation
        const cellIndex = row * this.COLS + col;
        const cell = this.boardElement.children[cellIndex];

        const piece = document.createElement('div');
        piece.className = `piece ${player === 1 ? 'red' : 'yellow'} dropping`;

        // Calculate drop distance based on row
        const dropDistance = (row + 1) * (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size')) || 60);
        const dropDuration = 0.3 + (row * 0.08);

        piece.style.setProperty('--drop-distance', `${dropDistance}px`);
        piece.style.setProperty('--drop-duration', `${dropDuration}s`);

        cell.appendChild(piece);

        // Play drop sound effect
        this.playDropSound(row);

        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, dropDuration * 1000));

        piece.classList.remove('dropping');

        // For local mode, check win/draw and switch player
        if (this.mode === 'local') {
            // Check for win
            const winningCells = this.checkWin(row, col);
            if (winningCells) {
                this.handleWin(winningCells);
                return;
            }

            // Check for draw
            if (this.checkDraw()) {
                this.handleDraw();
                return;
            }

            // Switch player
            this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
            this.updateTurnIndicator();
            this.updateColumnIndicators();
        } else {
            // Online mode - switch to next player
            this.currentPlayer = player === 1 ? 2 : 1;
            this.updateTurnIndicator();
            this.updateColumnIndicators();
            this.updateBoardInteractivity();
        }

        this.isAnimating = false;
    }

    playDropSound(row) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 200 - (row * 15);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            // Audio not supported or blocked
        }
    }

    checkWin(row, col) {
        const player = this.board[row][col];
        const directions = [
            [[0, 1], [0, -1]],
            [[1, 0], [-1, 0]],
            [[1, 1], [-1, -1]],
            [[1, -1], [-1, 1]]
        ];

        for (const [dir1, dir2] of directions) {
            const cells = [[row, col]];

            let r = row + dir1[0];
            let c = col + dir1[1];
            while (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && this.board[r][c] === player) {
                cells.push([r, c]);
                r += dir1[0];
                c += dir1[1];
            }

            r = row + dir2[0];
            c = col + dir2[1];
            while (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && this.board[r][c] === player) {
                cells.push([r, c]);
                r += dir2[0];
                c += dir2[1];
            }

            if (cells.length >= this.CONNECT) {
                return cells;
            }
        }

        return null;
    }

    checkDraw() {
        return this.board[0].every(cell => cell !== 0);
    }

    handleWin(winningCells) {
        this.gameOver = true;
        this.isAnimating = false;

        this.scores[this.currentPlayer]++;
        if (this.mode === 'local') {
            this.saveScores();
        }
        this.updateScoreDisplay();

        winningCells.forEach(([row, col]) => {
            const cellIndex = row * this.COLS + col;
            const cell = this.boardElement.children[cellIndex];
            const piece = cell.querySelector('.piece');
            if (piece) {
                piece.classList.add('winning');
            }
        });

        this.boardElement.querySelectorAll('.cell').forEach(cell => {
            cell.classList.add('disabled');
        });

        setTimeout(() => {
            this.winChip.className = `win-chip ${this.currentPlayer === 1 ? 'red' : 'yellow'}`;
            this.winTitle.textContent = `Player ${this.currentPlayer} Wins!`;
            this.winOverlay.classList.add('active');
            this.playWinSound();
        }, 800);
    }

    handleDraw() {
        this.gameOver = true;
        this.isAnimating = false;

        this.boardElement.querySelectorAll('.cell').forEach(cell => {
            cell.classList.add('disabled');
        });

        setTimeout(() => {
            this.drawOverlay.classList.add('active');
        }, 500);
    }

    playWinSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const notes = [523.25, 659.25, 783.99, 1046.50];

            notes.forEach((freq, i) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = freq;
                oscillator.type = 'sine';

                const startTime = audioContext.currentTime + (i * 0.1);
                gainNode.gain.setValueAtTime(0.15, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

                oscillator.start(startTime);
                oscillator.stop(startTime + 0.3);
            });
        } catch (e) {
            // Audio not supported or blocked
        }
    }

    updateTurnIndicator() {
        this.turnChip.className = `turn-chip ${this.currentPlayer === 1 ? 'red' : 'yellow'}`;
        this.turnIndicator.className = `turn-indicator player-${this.currentPlayer}`;

        if (this.mode === 'online') {
            const isMyTurn = this.currentPlayer === this.app.playerNumber;
            this.turnText.textContent = isMyTurn ? 'Your Turn' : `Waiting for ${this.app.opponentUsername}`;
        } else {
            this.turnText.textContent = `Player ${this.currentPlayer}'s Turn`;
        }
    }

    updateColumnIndicators() {
        const indicators = this.columnIndicators.querySelectorAll('.column-indicator');
        indicators.forEach((indicator, col) => {
            const isFull = this.getLowestEmptyRow(col) === -1;
            indicator.classList.toggle('disabled', isFull);
        });
    }

    updateBoardInteractivity() {
        if (this.mode === 'online') {
            const isMyTurn = this.currentPlayer === this.app.playerNumber;
            this.boardElement.classList.toggle('waiting-turn', !isMyTurn);
        } else {
            this.boardElement.classList.remove('waiting-turn');
        }
    }

    updateScoreDisplay() {
        this.score1Element.textContent = this.scores[1];
        this.score2Element.textContent = this.scores[2];
    }

    saveScores() {
        try {
            localStorage.setItem('connectFourScores', JSON.stringify(this.scores));
        } catch (e) {
            // localStorage not available
        }
    }

    loadScores() {
        try {
            const saved = localStorage.getItem('connectFourScores');
            if (saved) {
                this.scores = JSON.parse(saved);
            }
        } catch (e) {
            // localStorage not available
        }
    }

    resetGame() {
        this.gameOver = false;
        this.isAnimating = false;
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;

        this.createBoard();
        this.updateTurnIndicator();
        this.updateColumnIndicators();
        this.updateBoardInteractivity();

        this.boardElement.classList.add('loading');
        setTimeout(() => {
            this.boardElement.classList.remove('loading');
        }, 1000);
    }

    resetScores() {
        this.scores = { 1: 0, 2: 0 };
        if (this.mode === 'local') {
            this.saveScores();
        }
        this.updateScoreDisplay();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ConnectFourApp();
});
