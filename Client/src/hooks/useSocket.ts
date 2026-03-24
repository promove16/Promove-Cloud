import { useEffect } from 'react';
import { Socket } from 'socket.io-client';

export const useSocket = (socket: Socket | null, enabled: boolean) => {
  useEffect(() => {
    if (!socket || !enabled) {
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.disconnect();
    };
  }, [enabled, socket]);
};
