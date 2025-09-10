/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import axios from "axios";
import { GitHubProject, MediaFile, GeneratedPost, APIResponse } from "../types";

export class GitHubService {
  private baseURL = "https://api.github.com";
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private getHeaders(includeAuth: boolean = true) {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GLOSS-App",
    };

    if (includeAuth && this.accessToken) {
      headers.Authorization = `token ${this.accessToken}`;
    }

    return headers;
  }

  private async makeRequest(url: string, config: any = {}) {
    try {
      // First try with authentication
      const response = await axios.get(url, {
        ...config,
        headers: this.getHeaders(true),
      });
      return response;
    } catch (error: any) {
      // If authentication fails (401), try without token for public repos
      if (error.response?.status === 401) {
        console.log(
          `Retrying request without authentication for public repo: ${url}`
        );
        const response = await axios.get(url, {
          ...config,
          headers: this.getHeaders(false),
        });
        return response;
      }
      throw error;
    }
  }

  async getUser(): Promise<APIResponse<Record<string, unknown>>> {
    try {
      const response = await axios.get(`${this.baseURL}/user`, {
        headers: this.getHeaders(),
      });
      return { success: true, data: response.data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  }

  async getUserRepos(username: string): Promise<APIResponse<GitHubProject[]>> {
    try {
      const response = await this.makeRequest(
        `${this.baseURL}/users/${username}/repos`,
        {
          params: {
            sort: "updated",
            per_page: 100,
            type: "owner",
          },
        }
      );

      const projects = await Promise.all(
        response.data.map(async (repo: any) => {
          const enrichedRepo = await this.enrichProjectData(repo);
          return enrichedRepo;
        })
      );

      return { success: true, data: projects };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  }

  private async enrichProjectData(repo: GitHubProject): Promise<GitHubProject> {
    try {
      // Get README
      const readme = await this.getReadme(repo.full_name);

      // Get languages
      const languages = await this.getLanguages(repo.full_name);

      // Get media files
      const media = await this.getMediaFiles(repo.full_name);

      // Get releases
      const releases = await this.getReleases(repo.full_name);

      return {
        ...repo,
        readme,
        languages: languages.data || {},
        media: media.data || { images: [], videos: [], documents: [] },
        releases: releases.data || [],
        contributors: [],
      };
    } catch (error) {
      console.error("Error enriching project data:", error);
      return {
        ...repo,
        readme: undefined,
        languages: {},
        media: { images: [], videos: [], documents: [] },
        releases: [],
        contributors: [],
      };
    }
  }

  async getReadme(fullName: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${fullName}/readme`,
        {
          headers: this.getHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getLanguages(
    fullName: string
  ): Promise<APIResponse<{ [key: string]: number }>> {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${fullName}/languages`,
        {
          headers: this.getHeaders(),
        }
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getMediaFiles(fullName: string): Promise<
    APIResponse<{
      images: MediaFile[];
      videos: MediaFile[];
      documents: MediaFile[];
    }>
  > {
    try {
      const media: {
        images: MediaFile[];
        videos: MediaFile[];
        documents: MediaFile[];
      } = {
        images: [],
        videos: [],
        documents: [],
      };

      // Check common directories for media files (including root directory)
      const directories = [
        "",
        "assets",
        "images",
        "media",
        "docs",
        "screenshots",
        "public",
        "static",
      ];

      for (const dir of directories) {
        try {
          const response = await this.makeRequest(
            `${this.baseURL}/repos/${fullName}/contents/${dir}`
          );

          if (Array.isArray(response.data)) {
            response.data.forEach((file: any) => {
              if (file.type === "file") {
                const extension = file.name.split(".").pop()?.toLowerCase();
                if (
                  ["jpg", "jpeg", "png", "gif", "webp"].includes(
                    extension || ""
                  )
                ) {
                  media.images.push({
                    name: file.name,
                    path: file.path,
                    download_url: file.download_url,
                    size: file.size,
                    type: "image",
                    extension: extension || "",
                  });
                } else if (
                  ["mp4", "avi", "mov", "webm"].includes(extension || "")
                ) {
                  media.videos.push({
                    name: file.name,
                    path: file.path,
                    download_url: file.download_url,
                    size: file.size,
                    type: "video",
                    extension: extension || "",
                  });
                } else if (
                  ["pdf", "doc", "docx", "txt", "md"].includes(extension || "")
                ) {
                  media.documents.push({
                    name: file.name,
                    path: file.path,
                    download_url: file.download_url,
                    size: file.size,
                    type: "document",
                    extension: extension || "",
                  });
                }
              }
            });
          }
        } catch (error) {
          // Directory doesn't exist, continue
        }
      }

      return { success: true, data: media };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getReleases(fullName: string): Promise<APIResponse<any[]>> {
    try {
      const response = await axios.get(
        `${this.baseURL}/repos/${fullName}/releases`,
        {
          headers: this.getHeaders(),
          params: { per_page: 10 },
        }
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export class LinkedInService {
  private baseURL = "https://api.linkedin.com/v2";
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private getHeaders(includeRestLiHeader = false) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };

    if (includeRestLiHeader) {
      headers["X-Restli-Protocol-Version"] = "2.0.0";
    }

    return headers;
  }

  async getUserInfo(): Promise<APIResponse<any>> {
    try {
      // Try the newer profile endpoint first
      const response = await axios.get(`${this.baseURL}/me`, {
        headers: this.getHeaders(),
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error(
        "LinkedIn getUserInfo error:",
        error.response?.data || error.message
      );
      const message =
        error.response?.data?.message || error.message || "Unknown error";
      return { success: false, error: `LinkedIn API Error: ${message}` };
    }
  }

  async sharePost(
    content: string,
    media?: string[],
    mediaAssets?: any[]
  ): Promise<APIResponse<any>> {
    try {
      console.log("LinkedIn sharePost starting via API route...");
      console.log("Content:", content?.substring(0, 100));
      console.log("Media URLs count:", media?.length || 0);
      console.log("Media assets count:", mediaAssets?.length || 0);

      // Use the Next.js API route instead of direct LinkedIn API call
      const response = await axios.post(
        "/api/linkedin/share",
        {
          content,
          media,
          mediaAssets,
          accessToken: this.accessToken,
        },
        {
          timeout: 20000, // 20 second timeout for server-side call
        }
      );

      console.log("API route response:", response.data);

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        return {
          success: false,
          error: response.data.error || "Unknown error from API route",
        };
      }
    } catch (error: any) {
      console.error("LinkedIn sharePost error details:");
      console.error("Error message:", error.message);
      console.error("Error code:", error.code);
      console.error("Response status:", error.response?.status);
      console.error("Response data:", error.response?.data);

      // Check for specific error types
      if (error.code === "ECONNABORTED") {
        return {
          success: false,
          error: "Request timed out. Please try again.",
        };
      }

      if (error.message === "Network Error") {
        return {
          success: false,
          error:
            "Network error - please check your internet connection and try again.",
        };
      }

      const message =
        error.response?.data?.error || error.message || "Unknown error";
      return { success: false, error: `LinkedIn sharing failed: ${message}` };
    }
  }

  async uploadImage(imageFile: File): Promise<APIResponse<string>> {
    try {
      // Get user info for person URN
      const userInfo = await this.getUserInfo();
      if (!userInfo.success) {
        return { success: false, error: "Failed to get user information" };
      }

      const personUrn = `urn:li:person:${userInfo.data.sub}`;

      // Step 1: Register upload
      const registerData = {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: personUrn,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      };

      const registerResponse = await axios.post(
        `${this.baseURL}/assets?action=registerUpload`,
        registerData,
        { headers: this.getHeaders() }
      );

      const uploadUrl =
        registerResponse.data.value.uploadMechanism[
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ].uploadUrl;
      const assetId = registerResponse.data.value.asset;

      // Step 2: Upload binary file
      const formData = new FormData();
      formData.append("file", imageFile);

      await axios.post(uploadUrl, formData, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return { success: true, data: assetId };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  }
}

export class DeepSeekService {
  private baseURL = "https://openrouter.ai/api/v1";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.validateApiKey();
  }

  private validateApiKey() {
    if (!this.apiKey || this.apiKey.trim() === "") {
      throw new Error("API anahtarı gerekli");
    }

    if (!this.apiKey.startsWith("sk-")) {
      console.warn(
        "⚠️ API anahtarı sk- ile başlamıyor. OpenRouter anahtarınızı kontrol edin."
      );
    }
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://gloss-app.vercel.app",
      "X-Title": "GLOSS - GitHub LinkedIn Open Source System",
    };
  }

  async generatePost(
    project: GitHubProject,
    isQuickShare: boolean = false
  ): Promise<APIResponse<GeneratedPost>> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(
          `🤖 Starting DeepSeek API call (attempt ${attempts}/${maxAttempts})...`
        );

        const prompt = this.createPrompt(project, isQuickShare);

        const response = await axios.post(
          `${this.baseURL}/chat/completions`,
          {
            model: "deepseek/deepseek-chat-v3.1:free",
            messages: [
              {
                role: "system",
                content:
                  "You are a professional LinkedIn content creator. Generate engaging posts about GitHub projects that highlight key features, technical stack, and value proposition. Keep posts under 1300 characters and include relevant hashtags.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            max_tokens: 500,
            temperature: 0.7,
          },
          {
            headers: this.getHeaders(),
            timeout: 30000, // 30 saniye timeout
          }
        );

        const generatedContent = response.data.choices[0].message.content;
        const hashtags = this.extractHashtags(generatedContent);
        const content = generatedContent.replace(/#\w+/g, "").trim();

        console.log("✅ DeepSeek API call successful");
        return {
          success: true,
          data: {
            content,
            hashtags,
            suggestedMedia: project.media?.images || [], // Tüm görselleri al, sınırlama yok
          },
        };
      } catch (error: any) {
        console.error(
          `❌ DeepSeek API Error (attempt ${attempts}):`,
          error.response?.status,
          error.message
        );

        // Rate limit hatası için özel işlem
        if (error.response?.status === 429) {
          if (attempts < maxAttempts) {
            const waitTime = Math.pow(2, attempts) * 1000; // Exponential backoff: 2s, 4s, 8s
            console.log(
              `⏱️ Rate limit hit, waiting ${waitTime / 1000}s before retry...`
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue; // Tekrar dene
          } else {
            return {
              success: false,
              error:
                "API rate limit aşıldı. Lütfen birkaç dakika sonra tekrar deneyin. Free tier günlük limitiniz dolmuş olabilir.",
            };
          }
        }

        // Diğer hatalarda hemen çık
        if (error.response?.status === 401) {
          return {
            success: false,
            error:
              "API anahtarınız geçersiz. Lütfen OpenRouter API anahtarınızı kontrol edin.",
          };
        }

        if (error.response?.status === 403) {
          return {
            success: false,
            error:
              "API erişimi reddedildi. API anahtarınızın yetkilerini kontrol edin.",
          };
        }

        return { success: false, error: `AI servisi hatası: ${error.message}` };
      }
    }

    return { success: false, error: "Maksimum deneme sayısına ulaşıldı." };
  }

  private createPrompt(project: GitHubProject, isQuickShare: boolean): string {
    const stats = `⭐ ${project.stargazers_count} stars, 🍴 ${project.forks_count} forks`;
    const tech = project.language ? `Built with ${project.language}` : "";
    const topics =
      project.topics.length > 0 ? `Topics: ${project.topics.join(", ")}` : "";

    if (isQuickShare) {
      return `Generate a professional LinkedIn post for this GitHub project:
      
Project: ${project.name}
Description: ${project.description || "No description provided"}
GitHub URL: ${project.html_url}
${stats}
${tech}
${topics}
Homepage: ${project.homepage || "None"}

Create an engaging post that highlights the project's value and technical aspects. Include the GitHub URL in the post and relevant hashtags.

IMPORTANT FORMATTING GUIDELINES:
- Use **bold text** for important project features (will be converted to LinkedIn bold formatting)
- Use *italic text* for emphasis (will be converted to LinkedIn italic formatting)
- Structure content with clear sections using emojis as separators
- Keep it professional and engaging for developer audience
- Include clickable GitHub URL prominently
- Make the post visually appealing with proper formatting`;
    } else {
      return `Generate a detailed LinkedIn post for this GitHub project that I can customize:
      
Project: ${project.name}
Description: ${project.description || "No description provided"}
GitHub URL: ${project.html_url}
${stats}
${tech}
${topics}
README available: ${project.readme ? "Yes" : "No"}
Recent activity: Last updated ${new Date(
        project.updated_at
      ).toLocaleDateString()}

Create a comprehensive post that showcases the project's features, technical implementation, and potential impact. Make sure to include the GitHub URL so people can check out the project. Make it engaging and professional.

IMPORTANT FORMATTING GUIDELINES:
- Use **bold text** for key features and important points (will be converted to LinkedIn bold formatting)
- Use *italic text* for emphasis and technical terms (will be converted to LinkedIn italic formatting)
- Structure content with clear sections using emojis as visual separators
- Keep it professional yet engaging for developer audience
- Include clickable GitHub URL prominently in the post
- Make the content visually appealing with proper LinkedIn formatting`;
    }
  }

  private extractHashtags(content: string): string[] {
    const hashtagRegex = /#\w+/g;
    const matches = content.match(hashtagRegex);
    return matches ? matches.map((tag) => tag.toLowerCase()) : [];
  }
}
