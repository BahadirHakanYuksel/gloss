"use client";

import React, { useState } from "react";
import { Key, Github, Linkedin, Bot, Eye, EyeOff, Save, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { UserCredentials } from "../types";

interface LoginFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onCancel }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { setCredentials, credentials, updateCredentials } = useAuth();
  const [formData, setFormData] = useState({
    githubUsername: credentials?.github?.username || "",
    githubToken: credentials?.github?.accessToken || "",
    linkedinToken: credentials?.linkedin?.accessToken || "",
    openaiKey: credentials?.openai?.apiKey || "",
  });
  const [showTokens, setShowTokens] = useState({
    github: false,
    linkedin: false,
    openai: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const toggleTokenVisibility = (field: keyof typeof showTokens) => {
    setShowTokens((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.githubUsername.trim()) {
      newErrors.githubUsername = "GitHub username is required";
    }

    if (!formData.githubToken.trim()) {
      newErrors.githubToken = "GitHub access token is required";
    } else if (
      !formData.githubToken.startsWith("ghp_") &&
      !formData.githubToken.startsWith("github_pat_")
    ) {
      newErrors.githubToken = "Invalid GitHub token format";
    }

    if (!formData.linkedinToken.trim()) {
      newErrors.linkedinToken = "LinkedIn access token is required";
    }

    if (!formData.openaiKey.trim()) {
      newErrors.openaiKey = "OpenRouter API key is required";
    } else if (!formData.openaiKey.startsWith("sk-")) {
      newErrors.openaiKey = "Invalid OpenRouter API key format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const newCredentials: UserCredentials = {
        github: {
          username: formData.githubUsername.trim(),
          accessToken: formData.githubToken.trim(),
        },
        linkedin: {
          accessToken: formData.linkedinToken.trim(),
        },
        openai: {
          apiKey: formData.openaiKey.trim(),
        },
      };

      setCredentials(newCredentials);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving credentials:", error);
      setErrors({ submit: "Failed to save credentials. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const isUpdateMode = !!credentials;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-2xl p-8 w-full max-w-md border border-gray-100 dark:border-gray-700 relative">
        {/* Cancel button - Only show in update mode */}
        {isUpdateMode && onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-8">
          <div className="bg-blue-100 dark:bg-blue-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isUpdateMode ? "Update Credentials" : "Welcome to GLOSS"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isUpdateMode
              ? "Update your API credentials below"
              : "Enter your API credentials to get started"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* GitHub Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 font-medium">
              <Github className="w-5 h-5" />
              <span>GitHub Credentials</span>
            </div>

            <div>
              <label
                htmlFor="githubUsername"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Username
              </label>{" "}
              <input
                type="text"
                id="githubUsername"
                name="githubUsername"
                value={formData.githubUsername}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent ${
                  errors.githubUsername
                    ? "border-red-500 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="your-github-username"
              />
              {errors.githubUsername && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                  {errors.githubUsername}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="githubToken"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Access Token
              </label>
              <div className="relative">
                <input
                  type={showTokens.github ? "text" : "password"}
                  id="githubToken"
                  name="githubToken"
                  value={formData.githubToken}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent ${
                    errors.githubToken
                      ? "border-red-500 dark:border-red-400"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                />
                <button
                  type="button"
                  onClick={() => toggleTokenVisibility("github")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showTokens.github ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.githubToken && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                  {errors.githubToken}
                </p>
              )}
            </div>
          </div>

          {/* LinkedIn Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 font-medium">
              <Linkedin className="w-5 h-5" />
              <span>LinkedIn Credentials</span>
            </div>

            <div>
              <label
                htmlFor="linkedinToken"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Access Token
              </label>
              <div className="relative">
                <input
                  type={showTokens.linkedin ? "text" : "password"}
                  id="linkedinToken"
                  name="linkedinToken"
                  value={formData.linkedinToken}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent ${
                    errors.linkedinToken
                      ? "border-red-500 dark:border-red-400"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="Your LinkedIn access token"
                />
                <button
                  type="button"
                  onClick={() => toggleTokenVisibility("linkedin")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showTokens.linkedin ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.linkedinToken && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                  {errors.linkedinToken}
                </p>
              )}
            </div>
          </div>

          {/* DeepSeek/OpenRouter Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 font-medium">
              <Bot className="w-5 h-5" />
              <span>DeepSeek AI via OpenRouter</span>
            </div>

            <div>
              <label
                htmlFor="openaiKey"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                OpenRouter API Key
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Get your free API key from{" "}
                <a
                  href="https://openrouter.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  openrouter.ai
                </a>{" "}
                for AI content generation
              </p>
              <div className="relative">
                <input
                  type={showTokens.openai ? "text" : "password"}
                  id="openaiKey"
                  name="openaiKey"
                  value={formData.openaiKey}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent ${
                    errors.openaiKey
                      ? "border-red-500 dark:border-red-400"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="sk-or-xxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <button
                  type="button"
                  onClick={() => toggleTokenVisibility("openai")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showTokens.openai ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.openaiKey && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                  {errors.openaiKey}
                </p>
              )}
            </div>
          </div>

          {errors.submit && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-red-700 dark:text-red-400 text-sm">
                {errors.submit}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 dark:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>
                {isLoading
                  ? "Saving..."
                  : isUpdateMode
                  ? "Update Credentials"
                  : "Save Credentials"}
              </span>
            </button>

            {/* Cancel button - Only show in update mode */}
            {isUpdateMode && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <X className="w-5 h-5" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your credentials are encrypted and stored locally
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
