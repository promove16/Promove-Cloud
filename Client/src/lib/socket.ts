import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? import.meta.env.VITE_API_BASE_URL ?? window.location.origin;

let scoreSocket: Socket | null = null;
let chatSocket: Socket | null = null;
let notifSocket: Socket | null = null;
let mentorSocket: Socket | null = null;

const getToken = () => useAuthStore.getState().accessToken;

const applyAuth = (socket: Socket) => {
  socket.auth = {
    token: getToken(),
  };
};

export const getScoreSocket = () => {
  if (!scoreSocket) {
    scoreSocket = io(`${SOCKET_URL}/score`, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  applyAuth(scoreSocket);
  return scoreSocket;
};

export const getChatSocket = () => {
  if (!chatSocket) {
    chatSocket = io(`${SOCKET_URL}/chat`, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  applyAuth(chatSocket);
  return chatSocket;
};

export const getNotifSocket = () => {
  if (!notifSocket) {
    notifSocket = io(`${SOCKET_URL}/notifications`, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  applyAuth(notifSocket);
  return notifSocket;
};

export const getMentorSocket = () => {
  if (!mentorSocket) {
    mentorSocket = io(`${SOCKET_URL}/mentor`, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  applyAuth(mentorSocket);
  return mentorSocket;
};

export const disconnectAll = () => {
  scoreSocket?.disconnect();
  chatSocket?.disconnect();
  notifSocket?.disconnect();
  mentorSocket?.disconnect();
  scoreSocket = null;
  chatSocket = null;
  notifSocket = null;
  mentorSocket = null;
};
