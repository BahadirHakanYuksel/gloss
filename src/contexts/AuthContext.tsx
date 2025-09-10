"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { UserCredentials, GitHubProject } from "../types";
import { SecureStorage } from "../utils/helpers";
import { GitHubService } from "../services/api";

interface AuthContextType {
  credentials: UserCredentials | null;
  projects: GitHubProject[];
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  setCredentials: (credentials: UserCredentials) => void;
  updateCredentials: (updates: Partial<UserCredentials>) => void;
  logout: () => void;
  refreshProjects: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [credentials, setCredentialsState] = useState<UserCredentials | null>(
    null
  );
  const [projects, setProjects] = useState<GitHubProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load credentials from secure storage on mount
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const savedCredentials =
          SecureStorage.getItem<UserCredentials>("credentials");
        if (savedCredentials) {
          setCredentialsState(savedCredentials);
        }
      } catch (error) {
        console.error("Error loading credentials:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    loadCredentials();
  }, []);

  // Load projects when credentials are available
  useEffect(() => {
    if (credentials?.github?.accessToken && credentials?.github?.username) {
      refreshProjects();
    }
  }, [credentials]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCredentials = (newCredentials: UserCredentials) => {
    setCredentialsState(newCredentials);
    SecureStorage.setItem("credentials", newCredentials);
    setError(null);
  };

  const updateCredentials = (updates: Partial<UserCredentials>) => {
    if (!credentials) return;

    const updatedCredentials = {
      ...credentials,
      ...updates,
      github: { ...credentials.github, ...updates.github },
      linkedin: { ...credentials.linkedin, ...updates.linkedin },
      openai: { ...credentials.openai, ...updates.openai },
    };

    setCredentials(updatedCredentials);
  };

  const logout = () => {
    setCredentialsState(null);
    setProjects([]);
    setError(null);
    SecureStorage.clear();
  };

  const refreshProjects = async () => {
    if (!credentials?.github?.accessToken || !credentials?.github?.username) {
      setError("GitHub credentials not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const githubService = new GitHubService(credentials.github.accessToken);
      const response = await githubService.getUserRepos(
        credentials.github.username
      );

      if (response.success && response.data) {
        setProjects(response.data);
      } else {
        setError(response.error || "Failed to fetch projects");
      }
    } catch (err) {
      setError("Failed to fetch projects. Please check your credentials.");
      console.error("Error fetching projects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    credentials,
    projects,
    isLoading,
    isInitializing,
    error,
    setCredentials,
    updateCredentials,
    logout,
    refreshProjects,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
