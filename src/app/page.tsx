"use client";

import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import LoginForm from "../components/LoginForm";
import ProjectList from "../components/ProjectList";
import ShareModal from "../components/ShareModal";
import LoadingScreen from "../components/LoadingScreen";
import { GitHubProject } from "../types";

export default function Home() {
  const { credentials, isInitializing } = useAuth();
  const [selectedProject, setSelectedProject] = useState<GitHubProject | null>(
    null
  );
  const [isQuickShare, setIsQuickShare] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleProjectSelect = (project: GitHubProject, quickShare: boolean) => {
    setSelectedProject(project);
    setIsQuickShare(quickShare);
    setShowShareModal(true);
  };

  const handleShowSettings = () => {
    setShowSettings(true);
  };

  const handleCloseModal = () => {
    setShowShareModal(false);
    setSelectedProject(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCloseSettings = () => {
    setShowSettings(false);
  };

  // Show loading screen during initialization
  if (isInitializing) {
    return <LoadingScreen />;
  }

  // Show login form if no credentials or if settings is open
  if (!credentials || showSettings) {
    return (
      <LoginForm
        onSuccess={() => {
          setShowSettings(false);
        }}
        onCancel={() => {
          setShowSettings(false);
        }}
      />
    );
  }

  return (
    <>
      <ProjectList
        onProjectSelect={handleProjectSelect}
        onShowSettings={handleShowSettings}
      />

      <ShareModal
        project={selectedProject}
        isQuickShare={isQuickShare}
        isOpen={showShareModal}
        onClose={handleCloseModal}
      />
    </>
  );
}
