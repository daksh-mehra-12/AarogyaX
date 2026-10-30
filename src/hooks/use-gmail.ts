import * as React from "react";
import { User as FirebaseUser } from "firebase/auth";
import {
  subscribeGmailAuth,
  connectGmail,
  disconnectGmail,
  getGmailAccessToken,
  getGmailUser,
  isGmailConnected,
} from "@/services/gmail";

export interface UseGmailReturn {
  isConnected: boolean;
  user: FirebaseUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  connect: () => Promise<{ user: FirebaseUser; token: string } | null>;
  disconnect: () => Promise<void>;
  clearError: () => void;
}

export function useGmail(): UseGmailReturn {
  const [token, setToken] = React.useState<string | null>(getGmailAccessToken());
  const [user, setUser] = React.useState<FirebaseUser | null>(getGmailUser());
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = subscribeGmailAuth((newUser, newToken) => {
      setUser(newUser);
      setToken(newToken);
    });
    return unsubscribe;
  }, []);

  const connect = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await connectGmail();
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect Gmail";
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await disconnectGmail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to disconnect Gmail";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = React.useCallback(() => setError(null), []);

  return {
    isConnected: !!token && !!user,
    user,
    token,
    isLoading,
    error,
    connect,
    disconnect,
    clearError,
  };
}
