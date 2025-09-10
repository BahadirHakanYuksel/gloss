// Core interfaces for the application

export interface GitHubProject {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  homepage: string | null;
  language: string | null;
  languages?: { [key: string]: number };
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  size: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  has_issues: boolean;
  has_projects: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  open_issues_count: number;
  license: {
    key: string;
    name: string;
    spdx_id: string;
    url: string;
  } | null;
  readme?: {
    content: string;
    encoding: string;
    size: number;
  };
  media?: {
    images: MediaFile[];
    videos: MediaFile[];
    documents: MediaFile[];
  };
  releases: GitHubRelease[];
  contributors: GitHubContributor[];
}

export interface MediaFile {
  name: string;
  path: string;
  download_url: string;
  size: number;
  type: "image" | "video" | "document";
  extension: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: {
    name: string;
    download_url: string;
    size: number;
  }[];
}

export interface GitHubContributor {
  login: string;
  avatar_url: string;
  contributions: number;
}

export interface UserCredentials {
  github: {
    username: string;
    accessToken: string;
  };
  linkedin: {
    accessToken: string;
  };
  openai: {
    apiKey: string;
  };
}

export interface LinkedInPost {
  content: string;
  media?: {
    images: string[];
    videos: string[];
  };
  hashtags: string[];
  visibility: "PUBLIC" | "CONNECTIONS";
}

export interface ShareSettings {
  useGithubMedia: boolean;
  selectedMedia: MediaFile[];
  externalMedia: File[];
  customContent?: string;
  hashtags: string[];
  visibility: "PUBLIC" | "CONNECTIONS";
}

export interface GeneratedPost {
  content: string;
  hashtags: string[];
  suggestedMedia: MediaFile[];
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AppState {
  user: UserCredentials | null;
  projects: GitHubProject[];
  isLoading: boolean;
  error: string | null;
}
