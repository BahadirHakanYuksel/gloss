"use client";

import React from "react";
import {
  Star,
  GitFork,
  Eye,
  Calendar,
  ExternalLink,
  Zap,
  Edit,
} from "lucide-react";
import { GitHubProject } from "../types";
import { formatDate, getLanguageColor, truncateText } from "../utils/helpers";

interface ProjectCardProps {
  project: GitHubProject;
  onQuickShare: (project: GitHubProject) => void;
  onCustomShare: (project: GitHubProject) => void;
  viewMode?: "grid" | "list";
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onQuickShare,
  onCustomShare,
  viewMode = "grid",
}) => {
  const primaryLanguage = project.language;
  const hasMedia =
    project.media &&
    (project.media.images.length > 0 || project.media.videos.length > 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 p-6 border border-gray-200 dark:border-gray-700 h-full flex flex-col group">
      {/* Desktop Liste Görünümü için Wrapper */}
      <div className="md:flex md:items-center">
        {/* Main Content - Left Side */}
        <div className="flex-1 md:mr-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 md:mb-2">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <a
                  href={project.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center gap-2 transition-all duration-300 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                >
                  {truncateText(project.name, 32)}

                  <ExternalLink className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-300 group-hover:translate-x-1" />
                </a>
              </div>

              {/*
                {project.description ? (
                <p className="text-gray-600 text-sm mb-3 leading-relaxed min-h-[3rem]">
                  {truncateText(project.description, 120)}
                </p>
              ) : (
                <p className="text-gray-400 text-sm mb-3 leading-relaxed min-h-[3rem] italic">
                  No description available
                </p>
              ) }

              */}
            </div>
          </div>

          {/* Language and Topics */}
          <div className="flex flex-wrap items-center gap-2.5 mb-4 md:mb-2">
            {primaryLanguage && (
              <span
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: getLanguageColor(primaryLanguage) }}
              >
                {primaryLanguage}
              </span>
            )}

            {project.topics.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800"
              >
                {topic}
              </span>
            ))}

            {project.languages &&
              Object.entries(project.languages)
                .slice(1)
                .map(([lang]) => (
                  <span
                    key={lang}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-600"
                  >
                    {lang}
                  </span>
                ))}

            {project.topics.length > 3 && (
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                +{project.topics.length - 3} more
              </span>
            )}

            {!primaryLanguage &&
              (!project.topics || project.topics.length === 0) &&
              (!project.languages ||
                Object.keys(project.languages).length === 0) && (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic font-light">
                  No information available. There may be only a README file.
                </span>
              )}
          </div>

          {/* Stats */}
          <div className="flex items-center space-x-5 text-sm text-gray-500 dark:text-gray-400 mb-4 md:mb-2">
            <div className="flex items-center space-x-1.5">
              <Star className="w-4 h-4" />
              <span className="font-medium">
                {project.stargazers_count.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <GitFork className="w-4 h-4" />
              <span className="font-medium">
                {project.forks_count.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <Eye className="w-4 h-4" />
              <span className="font-medium">
                {project.watchers_count.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">
                Updated {formatDate(project.updated_at)}
              </span>
            </div>
          </div>

          {/* Media indicator */}
          {hasMedia ? (
            <div className="flex items-center space-x-1.5 text-xs text-green-600 dark:text-green-400 mb-4 md:mb-2">
              <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
              <span className="font-medium">
                {project.media!.images.length} images,{" "}
                {project.media!.videos.length} videos
              </span>
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-4 md:mb-2 italic font-light">
              No media found for this project
            </div>
          )}

          {/* Additional Info - Sol tarafta kalacak */}
          <div className="pt-4 border-t border-gray-50 dark:border-gray-700 md:pt-3">
            <div className="flex items-center justify-start gap-2.5 text-xs text-gray-400 dark:text-gray-500">
              <span className="font-medium">
                {project.private ? "Private" : "Public"} repository
              </span>
              {project.license ? (
                <span className="font-medium">{project.license.name}</span>
              ) : (
                <span className="font-light">No license</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Sadece Desktop Liste Görünümünde Aktif */}
        {viewMode === "list" && (
          <div className="hidden md:block md:w-80 md:flex-shrink-0">
            {/* Action Buttons - Sadece Desktop Liste'ta sağ tarafta */}
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => onQuickShare(project)}
                className="w-full bg-blue-600 dark:bg-blue-600 text-white px-4 py-2.5 rounded-2xl font-medium hover:bg-blue-700 dark:hover:bg-blue-700 hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-2 shadow-sm hover:shadow-lg group-hover:shadow-lg"
              >
                <Zap className="w-4 h-4" />
                <span>Quick Share</span>
              </button>

              <button
                onClick={() => onCustomShare(project)}
                className="w-full bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-2xl font-medium hover:bg-gray-100 dark:hover:bg-gray-600 hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-2 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md"
              >
                <Edit className="w-4 h-4" />
                <span>Custom Share</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile/Grid Action Buttons - Grid formatında veya mobilde göster */}
      <div
        className={`flex space-x-3 mt-4 ${
          viewMode === "list" ? "md:hidden" : ""
        }`}
      >
        <button
          onClick={() => onQuickShare(project)}
          className="flex-1 bg-blue-600 dark:bg-blue-600 text-white px-4 py-2.5 rounded-2xl font-medium hover:bg-blue-700 dark:hover:bg-blue-700 hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-2 shadow-sm hover:shadow-lg"
        >
          <Zap className="w-4 h-4" />
          <span>Quick Share</span>
        </button>

        <button
          onClick={() => onCustomShare(project)}
          className="flex-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-2xl font-medium hover:bg-gray-100 dark:hover:bg-gray-600 hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-2 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md"
        >
          <Edit className="w-4 h-4" />
          <span>Custom Share</span>
        </button>
      </div>
    </div>
  );
};

export default ProjectCard;
