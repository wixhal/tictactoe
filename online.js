// online.js
document.addEventListener('DOMContentLoaded', () => {
    let socket;
    let onlineRoomId = null;
    let mySymbol = null;

    const original = {
        createRoom: window.createRoom,
        joinRoom: window.joinRoom,
        makeMove: window.makeMove,
        newGame: window.newGame,
        setMode: window.setMode
    };
    
    const switchToOnlineMode = () => {
        if (gameMode === 'online') return;
        gameMode = 'online';
        document.querySelector('.player-info').style.visibility = 'hidden';
        document.querySelector('.difficulty-dropdown').style.visibility = 'hidden';
        document.getElementById('p2-label').textContent = 'Opponent';
        document.getElementById('pvp-btn').classList.remove('active');
        document.getElementById('pvc-btn').classList.remove('active');
        resetGame();
        if (!socket || !socket.connected) {
            socket = io("https://tictactoe-o8gs.onrender.com");
            setupSocketListeners();
        }
    };

    window.createRoom = function() {
        switchToOnlineMode();
        socket.emit('create-room');
    };

    window.joinRoom = function() {
        switchToOnlineMode();
        const roomInput = document.querySelector('.room-input');
        const roomId = roomInput.value.trim();
        if (roomId) socket.emit('join-room', roomId);
    };
    
    window.makeMove = function(index) {
        if (gameMode === 'online') {
            if (mySymbol === currentPlayer && board[index] === '' && gameActive) {
                socket.emit('make-move', { roomId: onlineRoomId, index, symbol: mySymbol });
            }
        } else {
            original.makeMove(index);
        }
    };

    window.newGame = function() {
        if (gameMode === 'online' && onlineRoomId) {
            socket.emit('new-game-online', onlineRoomId);
        } else {
            original.newGame();
        }
    };

    window.setMode = function(mode) {
        if (gameMode === 'online' && mode !== 'online') {
            if (socket) socket.disconnect();
            socket = null;
            document.querySelector('.player-info').style.visibility = 'visible';
        }
        original.setMode(mode);
    };

    const updateBoardUI = () => {
        document.querySelectorAll('.cell').forEach((cell, index) => {
            cell.textContent = board[index];
            cell.classList.remove('winner');
        });
    };

    const updateOnlineScores = (scores) => {
        if (mySymbol) {
            const opponentSymbol = mySymbol === 'X' ? 'O' : 'X';
            document.getElementById('player1-score').textContent = scores[mySymbol];
            document.getElementById('player2-score').textContent = scores[opponentSymbol];
        }
        document.getElementById('draws-score').textContent = scores.draws;
    };

    const setupSocketListeners = () => {
        socket.on('room-created', (roomId) => {
            onlineRoomId = roomId;
            mySymbol = 'X';
            
            // --- UPDATED: SVG icon for copy button ---
            const copyIconSvg = `
                <svg id="copy-icon-svg" style="width:18px; height:18px; fill: white; cursor: pointer; vertical-align: middle; margin-left: 5px;" viewBox="0 0 24 24">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
            `;

            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = `Room Code: <strong style="color: #FF69B4; font-weight: bold;">${roomId}</strong> ${copyIconSvg}<br>Waiting for opponent...`;
            
            const copyButton = document.getElementById('copy-icon-svg');
            if (copyButton) {
                copyButton.addEventListener('click', () => {
                    navigator.clipboard.writeText(roomId).then(() => {
                        copyButton.style.fill = '#90EE90'; // Light green on success
                        copyButton.title = 'Copied!';
                        setTimeout(() => {
                            copyButton.style.fill = 'white'; // Revert after a short delay
                            copyButton.title = 'Copy code';
                        }, 1500);
                    }).catch(err => console.error('Failed to copy code.', err));
                });
            }

            document.querySelector('.online-sidebar').style.pointerEvents = 'none';
        });

        socket.on('game-start', (data) => {
            onlineRoomId = data.roomId;
            gameActive = true;
            board = data.board;
            currentPlayer = data.currentPlayer;
            mySymbol = data.players.find(p => p.id === socket.id)?.symbol;
            updateBoardUI();
            updateOnlineScores(data.scores);
            updateStatus(mySymbol === currentPlayer ? "It's your turn." : "Opponent's turn.");
            document.querySelector('.online-sidebar').style.display = 'none';
            document.getElementById('current-turn').textContent = currentPlayer;
        });

        socket.on('move-made', (data) => {
            board = data.board;
            currentPlayer = data.currentPlayer;
            updateBoardUI();
            updateStatus(mySymbol === currentPlayer ? "It's your turn." : "Opponent's turn.");
            document.getElementById('current-turn').textContent = currentPlayer;
        });
        
        socket.on('game-over', (data) => {
            board = data.board;
            gameActive = false;
            updateBoardUI();
            highlightWinningCells();
            updateOnlineScores(data.scores);

            if (data.winner === 'draw') {
                updateStatus("Draw!!");
            } else {
                updateStatus(data.winner === mySymbol ? "You Won!! 🥳" : "You Lost. 😢");
            }
        });

        socket.on('opponent-disconnected', () => {
            updateStatus('Opponent disconnected. You win!');
            gameActive = false;
        });

        socket.on('error-message', (message) => alert(message));
    };
});