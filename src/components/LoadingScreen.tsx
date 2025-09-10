import React from "react";

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-2xl p-8 max-w-md w-full mx-4 border border-gray-100 dark:border-gray-700">
        <div className="text-center">
          {/* GLOSS Logo */}
          <div className="mb-6">
            <img
              src="/gloss-logo.svg"
              alt="GLOSS - GitHub LinkedIn Open Source System"
              className="h-16 mx-auto mb-4"
            />
          </div>

          {/* Animated Loading Spinner */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 rounded-full animate-spin border-t-blue-600 dark:border-t-blue-400"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-transparent rounded-full animate-ping border-t-blue-400 dark:border-t-blue-500 opacity-20"></div>
            </div>
          </div>

          {/* Loading Text */}
          <div className="space-y-2">
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              Loading your workspace...
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Setting up your GitHub projects
            </p>
          </div>

          {/* Animated Dots */}
          <div className="flex justify-center space-x-1 mt-4">
            <div className="w-2 h-2 bg-blue-400 dark:bg-blue-500 rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-blue-400 dark:bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-2 h-2 bg-blue-400 dark:bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
