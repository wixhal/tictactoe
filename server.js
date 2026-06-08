// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
           cors: {
               origin: "*",
               methods: ["GET", "POST"]
           }
       });

const rooms = {};
const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

const checkWinner = (board) => {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
};

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.on('create-room', () => {
        let roomId;
        do {
            roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        } while (rooms[roomId]);

        rooms[roomId] = {
            players: [{ id: socket.id, symbol: 'X' }],
            board: ['', '', '', '', '', '', '', '', ''],
            currentPlayer: 'X',
            scores: { X: 0, O: 0, draws: 0 },
            lastStarter: 'O' // NEW: Set this so the first game starter will be 'X'
        };

        socket.join(roomId);
        socket.emit('room-created', roomId);
    });

    socket.on('join-room', (roomId) => {
        roomId = roomId.toUpperCase();
        const room = rooms[roomId];

        if (!room) return socket.emit('error-message', 'Room not found.');
        if (room.players.length >= 2) return socket.emit('error-message', 'Room is full.');
        
        room.players.push({ id: socket.id, symbol: 'O' });
        socket.join(roomId);

        // First game starts with 'X'
        room.currentPlayer = 'X';
        room.lastStarter = 'X';

        io.to(roomId).emit('game-start', {
            roomId: roomId,
            players: room.players,
            board: room.board,
            currentPlayer: room.currentPlayer,
            scores: room.scores
        });
    });

    socket.on('make-move', (data) => {
        const { roomId, index, symbol } = data;
        const room = rooms[roomId];

        if (!room || room.currentPlayer !== symbol || room.board[index] !== '') return;
        
        room.board[index] = symbol;
        
        const winner = checkWinner(room.board);
        if (winner) {
            room.scores[winner]++;
            io.to(roomId).emit('game-over', { winner, scores: room.scores, board: room.board });
        } else if (!room.board.includes('')) { // Draw
            room.scores.draws++;
            io.to(roomId).emit('game-over', { winner: 'draw', scores: room.scores, board: room.board });
        } else {
            room.currentPlayer = symbol === 'X' ? 'O' : 'X';
            io.to(roomId).emit('move-made', { board: room.board, currentPlayer: room.currentPlayer });
        }
    });

    socket.on('new-game-online', (roomId) => {
        const room = rooms[roomId];
        if (room) {
            room.board = ['', '', '', '', '', '', '', '', ''];
            
            // NEW: Alternate the starting player
            const newStarter = room.lastStarter === 'X' ? 'O' : 'X';
            room.currentPlayer = newStarter;
            room.lastStarter = newStarter; // Remember who is starting this game

            io.to(roomId).emit('game-start', {
                roomId: roomId,
                players: room.players,
                board: room.board,
                currentPlayer: room.currentPlayer,
                scores: room.scores
            });
        }
    });

    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);

            if (playerIndex !== -1) {
                if (room.players.length === 1) {
                    delete rooms[roomId];
                } else {
                    io.to(roomId).emit('opponent-disconnected');
                    room.players.splice(playerIndex, 1);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));