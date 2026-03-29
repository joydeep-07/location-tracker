import { io } from 'socket.io-client';
import { SOCKET_URL } from './endpoints';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});
