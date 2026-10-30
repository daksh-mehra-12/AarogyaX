import * as React from "react";
import { User } from "@/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  switchRole: (newRole: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(() => {
    return localStorage.getItem("aarogya_token");
  });
  const [user, setUser] = React.useState<User | null>(() => {
    const savedUser = localStorage.getItem("aarogya_user");
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const login = React.useCallback((newToken: string, newUser: User) => {
    localStorage.setItem("aarogya_token", newToken);
    localStorage.setItem("aarogya_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = React.useCallback(() => {
    localStorage.removeItem("aarogya_token");
    localStorage.removeItem("aarogya_user");
    setToken(null);
    setUser(null);
  }, []);

  const switchRole = React.useCallback(async (newRole: string) => {
    const roleEmailMap: Record<string, string> = {
      intern: "intern@test.com",
      junior: "jr@test.com",
      consultant: "consultant@test.com",
      admin: "admin@test.com",
    };
    const email = roleEmailMap[newRole] || "admin@test.com";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123" }),
      });
      if (res.ok) {
        const data = await res.json();
        login(data.token, data.user);
        return;
      }
    } catch {
      // fallback if offline
    }

    setUser((prev) => {
      const updated: User = prev
        ? { ...prev, role: newRole as any }
        : { id: 1, name: "Test User", email, role: newRole as any, createdAt: new Date().toISOString() };
      localStorage.setItem("aarogya_user", JSON.stringify(updated));
      return updated;
    });
  }, [login]);

  const value = React.useMemo(
    () => ({
      user,
      token,
      login,
      logout,
      switchRole,
      isAuthenticated: !!token,
    }),
    [user, token, login, logout, switchRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
