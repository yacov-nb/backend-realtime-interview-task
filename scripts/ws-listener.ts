import { io } from 'socket.io-client';

const userId = process.argv[2] ?? 'user-123';
const socketUrl = process.env.SOCKET_URL ?? 'http://localhost:3000';

const socket = io(socketUrl);

socket.on('connect', () => {
  console.log(`connected: ${socket.id}`);
  socket.emit('subscribe', { userId }, (ack: unknown) => {
    console.log('subscription ack:', ack);
  });
});

socket.on('measurement', (measurement) => {
  console.log('measurement:', measurement);
});

socket.on('connect_error', (error) => {
  console.error('connect_error:', error.message);
});
