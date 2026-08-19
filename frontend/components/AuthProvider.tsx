"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthUser = {
  user_id: string;
  full_name: string;
  email: string;
  company?: string | null;
  two_factor_enabled: boolean;
};

type AuthPayload = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password: string, otpCode?: string) => Promise<void>;
  register: (payload: {
    full_name: string;
    email: string;
    company?: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const STORAGE_KEY = "routealpha-auth";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      const storedSession = window.localStorage.getItem(STORAGE_KEY);

      if (!storedSession) {
        if (active) {
          setIsReady(true);
        }
        return;
      }

      try {
        const parsed = JSON.parse(storedSession) as {
          token?: string;
          user?: AuthUser;
        };

        if (!parsed.token) {
          window.localStorage.removeItem(STORAGE_KEY);
          if (active) {
            setIsReady(true);
          }
          return;
        }

        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${parsed.token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const currentUser = (await response.json()) as AuthUser;

        if (!active) {
          return;
        }

        setToken(parsed.token);
        setUser(currentUser);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    }

    bootstrapAuth();

    return () => {
      active = false;
    };
  }, []);

  const persistSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: nextToken, user: nextUser })
    );
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const handleAuthRequest = useCallback(async (
    endpoint: "/auth/login" | "/auth/register",
    payload: Record<string, string>
  ) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "Authentication failed.");
    }

    const data = (await response.json()) as AuthPayload;
    persistSession(data.access_token, data.user);
  }, [persistSession]);

  const login = useCallback(async (email: string, password: string, otpCode?: string) => {
    await handleAuthRequest(
      "/auth/login",
      otpCode ? { email, password, otp_code: otpCode } : { email, password }
    );
  }, [handleAuthRequest]);

  const register = useCallback(async (payload: {
    full_name: string;
    email: string;
    company?: string;
    password: string;
  }) => {
    await handleAuthRequest("/auth/register", payload);
  }, [handleAuthRequest]);

  const authFetch = useCallback(async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(input, {
      ...init,
      headers,
    });

    if (response.status === 401) {
      clearSession();
    }

    return response;
  }, [clearSession, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isReady,
      login,
      register,
      logout: clearSession,
      authFetch,
    }),
    [authFetch, clearSession, isReady, login, register, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
