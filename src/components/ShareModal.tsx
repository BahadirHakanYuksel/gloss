"use client";

import React, { useState, useEffect } from "react";
import NextImage from "next/image";
import {
  X,
  Upload,
  Image,
  Video,
  Trash2,
  Check,
  Loader,
  Share,
  Edit3,
  Hash,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  GitHubProject,
  MediaFile,
  ShareSettings,
  GeneratedPost,
} from "../types";
import { useAuth } from "../contexts/AuthContext";
import { DeepSeekService, LinkedInService } from "../services/api";
import { generateHashtags, formatLinkedInText } from "../utils/helpers";

interface ShareModalProps {
  project: GitHubProject | null;
  isQuickShare: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({
  project,
  isQuickShare,
  isOpen,
  onClose,
}) => {
  const { credentials } = useAuth();
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    useGithubMedia: true,
    selectedMedia: [],
    externalMedia: [],
    hashtags: [],
    visibility: "PUBLIC",
  });
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(
    null
  );
  const [customContent, setCustomContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadedMediaAssets, setUploadedMediaAssets] = useState<
    Array<{
      assetId: string;
      fileName: string;
      fileSize: number;
      fileType?: string; // Original MIME type
      mediaType: string; // LinkedIn media type
      category?: string; // FILE category (IMAGE/VIDEO)
      originalUrl?: string;
    }>
  >([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [failedUploads, setFailedUploads] = useState<
    Array<{
      fileName: string;
      error: string;
      retryCount: number;
    }>
  >([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );

  // LinkedIn API optimization - cache authorUrn to avoid repeated API calls
  const [cachedAuthorUrn, setCachedAuthorUrn] = useState<string | null>(null);
  const [isGettingAuthorUrn, setIsGettingAuthorUrn] = useState(false);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  useEffect(() => {
    if (project && isOpen) {
      resetForm();
      if (isQuickShare) {
        handleQuickGenerate();
      } else {
        handleCustomGenerate();
      }
    }
  }, [project, isOpen, isQuickShare]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setShareSettings({
      useGithubMedia: true,
      selectedMedia: [],
      externalMedia: [],
      hashtags: generateHashtags(project),
      visibility: "PUBLIC",
    });
    setGeneratedPost(null);
    setCustomContent("");
    setError(null);
    setSuccess(false);
    setUploadedMediaAssets([]);
    setIsUploadingMedia(false);
    setFailedUploads([]);
    setUploadProgress({});
    // Clear LinkedIn API cache
    setCachedAuthorUrn(null);
    setIsGettingAuthorUrn(false);
    // Reset drag and drop state
    setIsDragOver(false);
    setDragCounter(0);
  };

  const deduplicateHashtags = (hashtags: string[]): string[] => {
    return [...new Set(hashtags.map((tag) => tag.toLowerCase()))].slice(0, 10);
  };

  // Helper function to check if an image is LinkedIn compatible
  const isLinkedInCompatible = (media: MediaFile): boolean => {
    const supportedExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
    return supportedExtensions.includes(media.extension.toLowerCase());
  };

  // Helper function to filter LinkedIn-compatible images
  const getLinkedInCompatibleImages = (mediaList: MediaFile[]): MediaFile[] => {
    return mediaList.filter(
      (media) => media.type === "image" && isLinkedInCompatible(media)
    );
  };

  // Helper function to get incompatible images for warnings
  const getIncompatibleImages = (mediaList: MediaFile[]): MediaFile[] => {
    return mediaList.filter(
      (media) => media.type === "image" && !isLinkedInCompatible(media)
    );
  };

  const handleQuickGenerate = async () => {
    console.log("=== QUICK SHARE DEBUG START ===");
    console.log("Project:", project?.name);
    console.log("Credentials OpenAI:", !!credentials?.openai?.apiKey);
    console.log("Credentials LinkedIn:", !!credentials?.linkedin?.accessToken);

    if (!project || !credentials?.openai?.apiKey) {
      console.log(
        "❌ Quick Share stopped: Missing project or OpenAI credentials"
      );
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      console.log("🤖 Starting AI content generation...");
      const deepSeekService = new DeepSeekService(credentials.openai.apiKey);
      const response = await deepSeekService.generatePost(project, true);

      console.log("🤖 AI Response:", response);

      if (response.success && response.data) {
        console.log("✅ AI content generated successfully");
        setGeneratedPost(response.data);
        setCustomContent(response.data.content);
        setShareSettings((prev) => ({
          ...prev,
          selectedMedia: response.data!.suggestedMedia,
          hashtags: deduplicateHashtags([
            ...prev.hashtags,
            ...response.data!.hashtags,
          ]),
        }));

        // Auto-upload GitHub images if available and LinkedIn credentials exist
        let autoUploadedAssets: Array<{
          assetId: string;
          fileName: string;
          fileSize: number;
          fileType?: string;
          mediaType: string;
          category?: string;
          originalUrl?: string;
        }> = [];
        if (
          credentials?.linkedin?.accessToken &&
          response.data.suggestedMedia.length > 0
        ) {
          console.log("📸 Starting auto-upload of GitHub images...");
          autoUploadedAssets = await handleAutoUploadGitHubImages(
            response.data.suggestedMedia
          );
          console.log("📸 Auto-upload completed. Assets:", autoUploadedAssets);
        } else {
          console.log(
            "⚠️ Skipping image upload - No LinkedIn credentials or no suggested media"
          );
        }

        // Auto-share for quick share with uploaded assets
        console.log("🚀 Starting LinkedIn share...");
        await handleShare(response.data.content, autoUploadedAssets);
        console.log("✅ Quick Share completed successfully");
      } else {
        console.log("❌ AI generation failed:", response.error);
        setError(response.error || "Failed to generate post");
      }
    } catch (err) {
      console.log("💥 Quick Share error:", err);
      setError("Failed to generate post. Please try again.");
      console.error("Error generating post:", err);
    } finally {
      setIsGenerating(false);
      console.log("=== QUICK SHARE DEBUG END ===");
    }
  };

  const handleCustomGenerate = async () => {
    if (!project || !credentials?.openai?.apiKey) return;

    setIsGenerating(true);
    setError(null);

    try {
      const deepSeekService = new DeepSeekService(credentials.openai.apiKey);
      const response = await deepSeekService.generatePost(project, false);

      if (response.success && response.data) {
        setGeneratedPost(response.data);
        setCustomContent(response.data.content);
        setShareSettings((prev) => ({
          ...prev,
          selectedMedia: response.data!.suggestedMedia,
          hashtags: deduplicateHashtags([
            ...prev.hashtags,
            ...response.data!.hashtags,
          ]),
        }));
      } else {
        setError(response.error || "Failed to generate post");
      }
    } catch (err) {
      setError("Failed to generate post. Please try again.");
      console.error("Error generating post:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async (
    content?: string,
    overrideMediaAssets?: Array<{
      assetId: string;
      fileName: string;
      fileSize: number;
      fileType?: string; // Original MIME type
      mediaType: string; // LinkedIn media type
      category?: string; // FILE category (IMAGE/VIDEO)
      originalUrl?: string;
    }>
  ) => {
    console.log("=== HANDLE SHARE DEBUG START ===");
    console.log("Project:", project?.name);
    console.log("LinkedIn credentials:", !!credentials?.linkedin?.accessToken);
    console.log("Content:", content?.substring(0, 100) + "...");
    console.log("Override media assets:", overrideMediaAssets);

    if (!project || !credentials?.linkedin?.accessToken) {
      console.log("❌ Share stopped: Missing project or LinkedIn credentials");
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      console.log("🔗 Creating LinkedIn service...");
      const linkedinService = new LinkedInService(
        credentials.linkedin.accessToken
      );
      const postContent = content || customContent;
      const hashtagsText = shareSettings.hashtags.join(" ");

      // LinkedIn için özel formatlanmış içerik oluştur
      const formattedContent = formatLinkedInText(postContent);
      const finalContent = `${formattedContent}\n\n${hashtagsText}`;

      console.log("📝 Final content:", finalContent);
      console.log("🏷️ Hashtags:", shareSettings.hashtags);

      // Use override assets if provided (for quick share), otherwise use state
      const assetsToUse = overrideMediaAssets || uploadedMediaAssets;

      console.log("📊 Media Debug Info:");
      console.log("  - Selected GitHub media:", shareSettings.selectedMedia);
      console.log("  - Uploaded media assets:", uploadedMediaAssets);
      console.log("  - Override media assets:", overrideMediaAssets);
      console.log("  - Assets to use for sharing:", assetsToUse);

      // Detailed asset breakdown
      if (assetsToUse && assetsToUse.length > 0) {
        console.log("🔍 Detailed media asset breakdown:");
        assetsToUse.forEach((asset, index) => {
          console.log(`  ${index + 1}. ${asset.fileName}:`);
          console.log(`     - File Type: ${asset.fileType || "unknown"}`);
          console.log(`     - Media Type: ${asset.mediaType}`);
          console.log(`     - Category: ${asset.category || "not set"}`);
          console.log(`     - Asset ID: ${asset.assetId}`);
        });
      }

      console.log("🚀 Calling LinkedIn API...");
      // Use uploaded media assets instead of external URLs
      const response = await linkedinService.sharePost(
        finalContent,
        [], // External URLs (not supported)
        assetsToUse // Use the determined assets
      );

      console.log("📤 LinkedIn API response:", response);

      if (response.success) {
        console.log("✅ LinkedIn post shared successfully!");
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        console.log("❌ LinkedIn sharing failed:", response.error);
        setError(response.error || "Failed to share post");
      }
    } catch (err) {
      console.log("💥 Share error:", err);
      setError("Failed to share post. Please try again.");
      console.error("Error sharing post:", err);
    } finally {
      setIsSharing(false);
      console.log("=== HANDLE SHARE DEBUG END ===");
    }
  };

  const handleMediaSelect = (media: MediaFile) => {
    // Upload edilmiş görsellerin tekrar seçilmesini engelle
    if (isImageUploaded(media.name)) {
      return; // Upload edilmiş görsel tekrar seçilemez
    }

    setShareSettings((prev) => ({
      ...prev,
      selectedMedia: prev.selectedMedia.find((m) => m.path === media.path)
        ? prev.selectedMedia.filter((m) => m.path !== media.path)
        : [...prev.selectedMedia, media],
    }));
  };

  const handleExternalMediaUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploadingMedia(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Add to external media list for preview
        setShareSettings((prev) => ({
          ...prev,
          externalMedia: [...prev.externalMedia, file],
        }));

        // Upload to LinkedIn if token is available
        if (credentials?.linkedin?.accessToken) {
          await uploadSingleFile(file, shareSettings.externalMedia.length + i);
        }
      }
    } catch (err) {
      console.error("Error uploading media:", err);
      setError("Failed to upload media files");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const removeExternalMedia = (index: number) => {
    const fileToRemove = shareSettings.externalMedia[index];

    setShareSettings((prev) => ({
      ...prev,
      externalMedia: prev.externalMedia.filter((_, i) => i !== index),
    }));

    // Also remove from uploaded assets if exists
    setUploadedMediaAssets((prev) => prev.filter((_, i) => i !== index));

    // Clean up failed uploads and progress for this file
    if (fileToRemove) {
      setFailedUploads((prev) =>
        prev.filter((failed) => failed.fileName !== fileToRemove.name)
      );
      setUploadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[fileToRemove.name];
        return newProgress;
      });
    }
  };

  const handleUploadSelectedGitHubImages = async () => {
    if (
      !credentials?.linkedin?.accessToken ||
      shareSettings.selectedMedia.length === 0
    )
      return;

    setIsUploadingMedia(true);
    setError(null);

    try {
      // Filter only LinkedIn-compatible images
      const compatibleImages = getLinkedInCompatibleImages(
        shareSettings.selectedMedia
      );
      const incompatibleImages = getIncompatibleImages(
        shareSettings.selectedMedia
      );

      // Show warning for incompatible images
      if (incompatibleImages.length > 0) {
        setError(
          `⚠️ Skipping ${
            incompatibleImages.length
          } incompatible images: ${incompatibleImages
            .map((img) => `${img.name} (${img.extension.toUpperCase()})`)
            .join(
              ", "
            )}. Only PNG, JPG, GIF, and WebP are supported by LinkedIn.`
        );
      }

      for (const image of compatibleImages) {
        console.log(
          `Uploading LinkedIn-compatible GitHub image: ${image.name}`
        );

        // Get cached authorUrn
        const authorUrn = await getLinkedInAuthorUrn();
        if (!authorUrn) {
          setError("Failed to get LinkedIn authorUrn for image upload");
          break;
        }

        const response = await fetch("/api/linkedin/upload-github-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: image.download_url,
            fileName: image.name,
            accessToken: credentials.linkedin.accessToken,
            authorUrn: authorUrn,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log(
            `GitHub image uploaded successfully: ${image.name}`,
            result
          );

          setUploadedMediaAssets((prev) => [...prev, result.data]);
        } else {
          const error = await response.json();
          console.error(`Failed to upload GitHub image: ${image.name}`, error);
          setError(`Failed to upload ${image.name}: ${error.error}`);
          break;
        }
      }
    } catch (err) {
      console.error("Error uploading GitHub images:", err);
      setError("Failed to upload GitHub images");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleAutoUploadGitHubImages = async (
    suggestedMedia: MediaFile[]
  ): Promise<
    Array<{
      assetId: string;
      fileName: string;
      fileSize: number;
      fileType?: string;
      mediaType: string;
      category?: string;
      originalUrl?: string;
    }>
  > => {
    if (!credentials?.linkedin?.accessToken || suggestedMedia.length === 0)
      return [];

    setIsUploadingMedia(true);
    const uploadedAssets: Array<{
      assetId: string;
      fileName: string;
      fileSize: number;
      fileType?: string;
      mediaType: string;
      category?: string;
      originalUrl?: string;
    }> = [];

    try {
      // Filter only LinkedIn-compatible images
      const compatibleImages = getLinkedInCompatibleImages(suggestedMedia);
      const incompatibleImages = getIncompatibleImages(suggestedMedia);

      // Log warnings for incompatible images
      if (incompatibleImages.length > 0) {
        console.warn(
          `⚠️ Skipping ${incompatibleImages.length} incompatible images:`,
          incompatibleImages.map(
            (img) => `${img.name} (${img.extension.toUpperCase()})`
          )
        );
      }

      const selectedImages = compatibleImages.slice(0, 9); // LinkedIn maksimum 9 görsel destekler

      console.log(
        `Auto-uploading ${selectedImages.length} LinkedIn-compatible GitHub images for Quick Share (max 9)...`
      );

      // Get cached authorUrn once for all uploads
      const authorUrn = await getLinkedInAuthorUrn();
      if (!authorUrn) {
        console.error("Failed to get LinkedIn authorUrn for auto-upload");
        return uploadedAssets; // Return empty array but don't fail the entire process
      }

      for (const image of selectedImages) {
        console.log(`Auto-uploading GitHub image: ${image.name}`);

        const response = await fetch("/api/linkedin/upload-github-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: image.download_url,
            fileName: image.name,
            accessToken: credentials.linkedin.accessToken,
            authorUrn: authorUrn,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log(
            `GitHub image auto-uploaded successfully: ${image.name}`,
            result.data
          );
          console.log(
            `📁 GitHub image info - MediaType: ${result.data.mediaType}, Category: ${result.data.category}`
          );

          uploadedAssets.push(result.data);
          setUploadedMediaAssets((prev) => {
            const newAssets = [...prev, result.data];
            console.log(
              "📋 Updated uploadedMediaAssets (GitHub):",
              newAssets.map((asset) => ({
                name: asset.fileName,
                mediaType: asset.mediaType,
                category: asset.category,
              }))
            );
            return newAssets;
          });
        } else {
          const error = await response.json();
          console.error(
            `Failed to auto-upload GitHub image: ${image.name}`,
            error
          );
          // Don't break on error for auto-upload, just log and continue
          console.warn(`Continuing Quick Share without ${image.name}`);
        }
      }
    } catch (err) {
      console.error("Error auto-uploading GitHub images:", err);
      // Don't set error for auto-upload failures to avoid blocking quick share
      console.warn("Quick Share continuing without auto-uploaded images");
    } finally {
      setIsUploadingMedia(false);
    }

    return uploadedAssets;
  };

  // Helper function to get LinkedIn authorUrn with caching
  const getLinkedInAuthorUrn = async (): Promise<string | null> => {
    if (cachedAuthorUrn) {
      console.log("✅ Using cached LinkedIn authorUrn:", cachedAuthorUrn);
      return cachedAuthorUrn;
    }

    if (isGettingAuthorUrn) {
      console.log("⏳ Already getting LinkedIn authorUrn, waiting...");
      // Wait for the current request to complete
      while (isGettingAuthorUrn) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return cachedAuthorUrn;
    }

    if (!credentials?.linkedin?.accessToken) {
      console.error("❌ No LinkedIn access token available");
      return null;
    }

    setIsGettingAuthorUrn(true);
    console.log("🔍 Getting LinkedIn authorUrn from API...");

    try {
      const response = await fetch("/api/linkedin/get-author-urn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: credentials.linkedin.accessToken,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(
          "✅ LinkedIn authorUrn obtained and cached:",
          result.authorUrn
        );
        setCachedAuthorUrn(result.authorUrn);
        return result.authorUrn;
      } else {
        const error = await response.json();
        console.error("❌ Failed to get LinkedIn authorUrn:", error);
        return null;
      }
    } catch (err) {
      console.error("💥 Error getting LinkedIn authorUrn:", err);
      return null;
    } finally {
      setIsGettingAuthorUrn(false);
    }
  };

  // Helper function to check if a GitHub image is already uploaded
  const isImageUploaded = (imagePath: string): boolean => {
    return uploadedMediaAssets.some(
      (asset) => asset.fileName && imagePath.includes(asset.fileName)
    );
  };

  // Helper function to check if there are mixed media types
  const hasMixedMedia = (): boolean => {
    const hasImages = uploadedMediaAssets.some(
      (asset) =>
        asset.category === "IMAGE" || asset.mediaType === "feedshare-image"
    );
    const hasVideos = uploadedMediaAssets.some(
      (asset) =>
        asset.category === "VIDEO" || asset.mediaType === "feedshare-video"
    );
    return hasImages && hasVideos;
  };

  // Helper function to get upload status for a file
  const getUploadStatus = (fileName: string) => {
    const isUploaded = uploadedMediaAssets.some(
      (asset) => asset.fileName === fileName
    );
    const hasFailed = failedUploads.some(
      (failed) => failed.fileName === fileName
    );
    const progress = uploadProgress[fileName] || 0;

    return {
      isUploaded,
      hasFailed,
      progress,
      isUploading: progress > 0 && progress < 100 && !isUploaded && !hasFailed,
    };
  };

  // Helper function to retry failed upload
  const retryUpload = async (fileName: string) => {
    const failedUpload = failedUploads.find(
      (failed) => failed.fileName === fileName
    );
    if (!failedUpload || failedUpload.retryCount >= 3) return;

    // Find the original file in external media
    const fileIndex = shareSettings.externalMedia.findIndex(
      (file) => file.name === fileName
    );
    if (fileIndex === -1) return;

    const file = shareSettings.externalMedia[fileIndex];

    // Remove from failed uploads to attempt retry
    setFailedUploads((prev) =>
      prev.filter((failed) => failed.fileName !== fileName)
    );

    // Attempt upload again
    await uploadSingleFile(file, fileIndex, failedUpload.retryCount + 1);
  };

  // Helper function to upload a single file with retry logic
  const uploadSingleFile = async (
    file: File,
    index: number,
    retryCount: number = 0
  ) => {
    if (!credentials?.linkedin?.accessToken) return;

    const fileName = file.name;
    setUploadProgress((prev) => ({ ...prev, [fileName]: 10 }));

    try {
      console.log(
        `Uploading ${fileName} to LinkedIn (attempt ${retryCount + 1})...`
      );

      // Get cached authorUrn
      const authorUrn = await getLinkedInAuthorUrn();
      if (!authorUrn) {
        throw new Error("Failed to get LinkedIn authorUrn");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("accessToken", credentials.linkedin.accessToken);
      formData.append("authorUrn", authorUrn);

      setUploadProgress((prev) => ({ ...prev, [fileName]: 50 }));

      const response = await fetch("/api/linkedin/upload-media", {
        method: "POST",
        body: formData,
      });

      setUploadProgress((prev) => ({ ...prev, [fileName]: 90 }));

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Upload successful for ${fileName}:`, result.data);
        console.log(
          `📁 File info - Type: ${file.type}, Category: ${result.data.category}, MediaType: ${result.data.mediaType}`
        );

        setUploadedMediaAssets((prev) => {
          const newAssets = [...prev, result.data];
          console.log(
            "📋 Updated uploadedMediaAssets:",
            newAssets.map((asset) => ({
              name: asset.fileName,
              mediaType: asset.mediaType,
              category: asset.category,
              fileType: asset.fileType,
            }))
          );
          return newAssets;
        });
        setUploadProgress((prev) => ({ ...prev, [fileName]: 100 }));

        // Remove from failed uploads if it was there
        setFailedUploads((prev) =>
          prev.filter((failed) => failed.fileName !== fileName)
        );
      } else {
        const error = await response.json();
        console.error(`❌ Failed to upload ${fileName}:`, error);

        setFailedUploads((prev) => [
          ...prev.filter((failed) => failed.fileName !== fileName),
          {
            fileName,
            error: error.error || "Upload failed",
            retryCount,
          },
        ]);
        setUploadProgress((prev) => ({ ...prev, [fileName]: 0 }));
      }
    } catch (err) {
      console.error(`💥 Upload error for ${fileName}:`, err);
      setFailedUploads((prev) => [
        ...prev.filter((failed) => failed.fileName !== fileName),
        {
          fileName,
          error: "Network error",
          retryCount,
        },
      ]);
      setUploadProgress((prev) => ({ ...prev, [fileName]: 0 }));
    }
  };

  const addHashtag = (hashtag: string) => {
    // Check for duplicates (case insensitive)
    const isDuplicate = shareSettings.hashtags.some(
      (existing) => existing.toLowerCase() === hashtag.toLowerCase()
    );

    if (!isDuplicate && shareSettings.hashtags.length < 10) {
      setShareSettings((prev) => ({
        ...prev,
        hashtags: [...prev.hashtags, hashtag],
      }));
    }
  };

  const removeHashtag = (hashtag: string) => {
    setShareSettings((prev) => ({
      ...prev,
      hashtags: prev.hashtags.filter((h) => h !== hashtag),
    }));
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev - 1);
    if (dragCounter <= 1) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragOver(false);
    setDragCounter(0);

    if (isUploadingMedia) return;

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    // Filter supported files
    const supportedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
    ];

    const validFiles = files.filter(
      (file) =>
        supportedTypes.includes(file.type) ||
        /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm)$/i.test(file.name)
    );

    if (validFiles.length === 0) {
      setError(
        "No supported file formats found. Please drop PNG, JPG, GIF, WebP images or MP4, MOV, AVI, WebM videos."
      );
      return;
    }

    if (validFiles.length !== files.length) {
      setError(
        `${
          files.length - validFiles.length
        } file(s) skipped due to unsupported format. Only PNG, JPG, GIF, WebP, MP4, MOV, AVI, WebM are supported.`
      );
    }

    setIsUploadingMedia(true);
    setError(null);

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];

        // Add to external media list for preview
        setShareSettings((prev) => ({
          ...prev,
          externalMedia: [...prev.externalMedia, file],
        }));

        // Upload to LinkedIn if token is available
        if (credentials?.linkedin?.accessToken) {
          await uploadSingleFile(file, shareSettings.externalMedia.length + i);
        }
      }
    } catch (err) {
      console.error("Error uploading dropped files:", err);
      setError("Failed to upload dropped files");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-blue-50/30 via-white/20 to-purple-50/30 dark:from-gray-900/40 dark:via-gray-800/30 dark:to-gray-900/40 backdrop-blur-lg flex items-center justify-center p-4 z-50 modal-backdrop"
      style={{
        background:
          "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(255, 255, 255, 0.2) 50%, rgba(147, 51, 234, 0.1) 100%)",
      }}
    >
      <div
        className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl ring-1 ring-white/20 dark:ring-gray-700/50 border border-gray-200/50 dark:border-gray-700/50 modal-content"
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/70 dark:border-gray-700/70 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-t-xl">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isQuickShare ? "Quick Share" : "Custom Share"} - {project.name}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {isQuickShare
                ? "Generating content, uploading images, and sharing automatically..."
                : "Customize your LinkedIn post"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 p-2 rounded-full hover:bg-gray-100/50 dark:hover:bg-gray-700/50 backdrop-blur-sm"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6 text-center">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <p className="text-green-700 dark:text-green-400 font-semibold">
                Successfully shared on LinkedIn!
              </p>
            </div>
          )}

          {isGenerating && (
            <div className="text-center py-8">
              <Loader className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {isUploadingMedia
                  ? "Uploading GitHub images and sharing to LinkedIn..."
                  : "Generating your LinkedIn post..."}
              </p>
            </div>
          )}

          {!isQuickShare && generatedPost && !isGenerating && (
            <div className="space-y-6">
              {/* Post Content */}
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm border border-white/20 dark:border-gray-600/20 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-lg font-semibold text-gray-800 dark:text-gray-200">
                    ✍️ Post Content
                  </label>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-white/50 dark:bg-gray-600/50 hover:bg-white/70 dark:hover:bg-gray-600/70 border border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200"
                  >
                    {showPreview ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    <span>{showPreview ? "Hide" : "Show"} Preview</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <textarea
                      value={customContent}
                      onChange={(e) => setCustomContent(e.target.value)}
                      rows={6}
                      maxLength={3000}
                      className="w-full px-4 py-3 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200 resize-none"
                      placeholder="✨ Write your LinkedIn post here..."
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-700/80 px-2 py-1 rounded-md">
                      {customContent.length}/3000
                    </div>
                  </div>

                  {/* Character Counter with Color Coding */}
                  <div className="flex justify-between items-center text-sm">
                    <div className="text-gray-600 dark:text-gray-400">
                      💡 Tip: Engaging posts get more views on LinkedIn
                    </div>
                    <div
                      className={`font-medium ${
                        customContent.length > 3000
                          ? "text-red-500 dark:text-red-400"
                          : customContent.length > 2000
                          ? "text-yellow-500 dark:text-yellow-400"
                          : "text-green-500 dark:text-green-400"
                      }`}
                    >
                      {customContent.length > 3000 && "⚠️ Too long!"}
                      {customContent.length > 2000 &&
                        customContent.length <= 3000 &&
                        "⚡ Almost at limit"}
                      {customContent.length <= 2000 && "✅ Good length"}
                    </div>
                  </div>

                  {/* LinkedIn Preview */}
                  {customContent && showPreview && (
                    <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl shadow-inner">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-6 h-6 bg-blue-600 dark:bg-blue-500 rounded flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            in
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                          💼 LinkedIn Preview (Formatted)
                        </p>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                        {formatLinkedInText(customContent)}
                        {shareSettings.hashtags.length > 0 && (
                          <>
                            {"\n\n"}
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              {shareSettings.hashtags.join(" ")}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Media Selection */}
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm border border-white/20 dark:border-gray-600/20 rounded-xl p-6 shadow-lg">
                <div className="flex items-center space-x-2 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Image className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    📸 Media Selection
                  </h3>
                </div>

                {/* LinkedIn Media Limitation Warning */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-blue-400 dark:border-blue-800 rounded-r-xl p-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <p className="flex items-center text-blue-800 dark:text-blue-300 font-medium">
                        📷 <span className="ml-2">GitHub Images</span>
                      </p>
                      <p className="text-blue-700 dark:text-blue-400 text-xs leading-relaxed">
                        Select and upload GitHub images directly to LinkedIn
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="flex items-center text-blue-800 dark:text-blue-300 font-medium">
                        💾 <span className="ml-2">Local Media</span>
                      </p>
                      <p className="text-blue-700 dark:text-blue-400 text-xs leading-relaxed">
                        Upload images and videos from your computer below
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="flex items-center text-amber-700 dark:text-amber-400 font-medium">
                        ⚠️ <span className="ml-2">Supported Formats</span>
                      </p>
                      <p className="text-amber-600 dark:text-amber-300 text-xs leading-relaxed">
                        📷 Images: PNG, JPG, GIF, WebP only (No SVG)
                      </p>
                      <p className="text-amber-600 dark:text-amber-300 text-xs leading-relaxed">
                        🎬 Videos: MP4, MOV, AVI, WebM
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="flex items-center text-green-700 dark:text-green-400 font-medium">
                        📏 <span className="ml-2">Size Limits</span>
                      </p>
                      <p className="text-green-600 dark:text-green-300 text-xs leading-relaxed">
                        📷 Images: Max 100MB, up to 36.15 megapixels
                      </p>
                      <p className="text-green-600 dark:text-green-300 text-xs leading-relaxed">
                        🎬 Videos: Max 5GB, up to 10 minutes duration
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 mb-6">
                  <label className="flex items-center space-x-3 cursor-pointer bg-white/60 dark:bg-gray-600/60 hover:bg-white/80 dark:hover:bg-gray-600/80 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 transition-all duration-200">
                    <input
                      type="checkbox"
                      checked={shareSettings.useGithubMedia}
                      onChange={(e) =>
                        setShareSettings((prev) => ({
                          ...prev,
                          useGithubMedia: e.target.checked,
                          selectedMedia: e.target.checked
                            ? prev.selectedMedia
                            : [],
                        }))
                      }
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-2"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                      <span className="mr-2">🔗</span>
                      Use images and videos from GitHub
                    </span>
                  </label>
                </div>

                {shareSettings.useGithubMedia && project.media && (
                  <div className="space-y-6">
                    {/* GitHub Images */}
                    {project.media.images.length > 0 && (
                      <div className="bg-white/50 dark:bg-gray-600/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                            <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center mr-2">
                              <Image className="w-3 h-3 text-white" />
                            </div>
                            GitHub Images ({project.media.images.length})
                          </h4>
                          <button
                            onClick={handleUploadSelectedGitHubImages}
                            disabled={
                              shareSettings.selectedMedia.length === 0 ||
                              isUploadingMedia ||
                              !credentials?.linkedin?.accessToken ||
                              shareSettings.selectedMedia.every((media) =>
                                isImageUploaded(media.name)
                              )
                            }
                            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center space-x-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                              shareSettings.selectedMedia.every((media) =>
                                isImageUploaded(media.name)
                              )
                                ? "bg-green-100 text-green-700 border border-green-200"
                                : "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200"
                            }`}
                          >
                            {isUploadingMedia ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : shareSettings.selectedMedia.every((media) =>
                                isImageUploaded(media.name)
                              ) ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            <span>
                              {shareSettings.selectedMedia.every((media) =>
                                isImageUploaded(media.name)
                              )
                                ? "✅ All Uploaded"
                                : "📤 Upload Selected"}
                            </span>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {project.media.images.map((image) => {
                            const isUploaded = isImageUploaded(image.name);
                            const isSelected = shareSettings.selectedMedia.find(
                              (m) => m.path === image.path
                            );

                            return (
                              <div
                                key={image.path}
                                className={`relative group border-2 rounded-xl overflow-hidden transition-all duration-200 cursor-pointer transform hover:scale-105 ${
                                  isUploaded
                                    ? "border-green-400 bg-green-50 dark:bg-green-900/20 shadow-lg shadow-green-100 dark:shadow-green-900/20"
                                    : isSelected
                                    ? "border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900/20 shadow-lg shadow-blue-100 dark:shadow-blue-900/20"
                                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md"
                                }`}
                                onClick={() =>
                                  !isUploaded && handleMediaSelect(image)
                                }
                              >
                                <NextImage
                                  src={image.download_url}
                                  alt={`${image.name} from ${project.name} repository`}
                                  width={400}
                                  height={120}
                                  className={`w-full h-28 object-cover transition-opacity duration-200 ${
                                    isUploaded
                                      ? "opacity-75"
                                      : "group-hover:opacity-90"
                                  }`}
                                  onError={() => {
                                    console.error(
                                      `Failed to load image: ${image.name}`,
                                      image.download_url
                                    );
                                  }}
                                  onLoad={() => {
                                    console.log(
                                      `Successfully loaded image: ${image.name}`
                                    );
                                  }}
                                />

                                {/* Image Name Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                  <p className="text-white text-xs font-medium truncate">
                                    {image.name}
                                  </p>
                                </div>

                                {/* Selection Indicator */}
                                {isSelected && !isUploaded && (
                                  <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1.5 shadow-lg">
                                    <Check className="w-3 h-3" />
                                  </div>
                                )}

                                {/* Upload Status Indicator */}
                                {isUploaded && (
                                  <>
                                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1.5 shadow-lg">
                                      <Check className="w-3 h-3" />
                                    </div>
                                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-sm">
                                      <span className="text-xs font-bold text-green-800 dark:text-green-300 bg-white/90 dark:bg-gray-800/90 px-3 py-1 rounded-full shadow-md">
                                        ✅ UPLOADED
                                      </span>
                                    </div>
                                  </>
                                )}

                                {/* Format Compatibility Indicator */}
                                {!isLinkedInCompatible(image) && (
                                  <div className="absolute top-2 left-2 bg-red-500 text-white rounded-lg px-2 py-1 shadow-lg">
                                    <span className="text-xs font-bold">
                                      ⚠️ SVG
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Upload Status Info */}
                        {uploadedMediaAssets.length > 0 && (
                          <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <p className="text-green-700 dark:text-green-400 text-xs">
                              ✅ {uploadedMediaAssets.length} image(s) uploaded
                              to LinkedIn and ready to share
                            </p>
                          </div>
                        )}

                        {/* Incompatible Format Warning */}
                        {getIncompatibleImages(project.media.images).length >
                          0 && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-red-700 dark:text-red-400 text-xs">
                              ⚠️{" "}
                              {
                                getIncompatibleImages(project.media.images)
                                  .length
                              }{" "}
                              image(s) with unsupported formats found (marked
                              with red labels). These cannot be uploaded to
                              LinkedIn. Convert to PNG/JPG format to use them.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* GitHub Videos */}
                    {project.media.videos.length > 0 && (
                      <div className="bg-white/50 dark:bg-gray-600/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600 mt-4">
                        <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                          <div className="w-6 h-6 bg-purple-500 rounded-md flex items-center justify-center mr-2">
                            <Video className="w-3 h-3 text-white" />
                          </div>
                          GitHub Videos ({project.media.videos.length})
                        </h4>
                        <div className="space-y-3">
                          {project.media.videos.map((video) => (
                            <div
                              key={video.path}
                              className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                                shareSettings.selectedMedia.find(
                                  (m) => m.path === video.path
                                )
                                  ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-100 dark:shadow-blue-900/20"
                                  : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white/60 dark:bg-gray-600/60"
                              }`}
                              onClick={() => handleMediaSelect(video)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                                    <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                  </div>
                                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {video.name}
                                  </span>
                                </div>
                                {shareSettings.selectedMedia.find(
                                  (m) => m.path === video.path
                                ) && (
                                  <div className="bg-blue-500 text-white rounded-full p-1">
                                    <Check className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* External Media Upload */}
                <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm border border-white/20 dark:border-gray-600/20 rounded-xl p-6 shadow-lg mt-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                    <label className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      💾 Upload Local Media
                    </label>
                  </div>

                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-l-4 border-indigo-400 dark:border-indigo-800 rounded-r-xl p-4 mb-4">
                    <p className="text-indigo-800 dark:text-indigo-300 text-sm leading-relaxed mb-2">
                      📁 Upload images and videos from your computer directly to
                      LinkedIn. Files will be uploaded immediately and attached
                      to your post.
                    </p>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-3">
                      <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                        ⚠️ <strong>LinkedIn Limitation:</strong> When you upload
                        both videos and images, LinkedIn will only show videos
                        due to platform restrictions. For best results, upload
                        either videos OR images, not both.
                      </p>
                    </div>
                  </div>

                  {/* Drag and Drop Area */}
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                      isDragOver
                        ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 scale-105"
                        : isUploadingMedia
                        ? "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
                        : "border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    {isDragOver && (
                      <div className="absolute inset-0 bg-indigo-500/10 border-2 border-indigo-500 border-dashed rounded-xl flex items-center justify-center">
                        <div className="text-indigo-600 dark:text-indigo-400">
                          <Upload className="w-12 h-12 mx-auto mb-2 animate-bounce" />
                          <p className="text-lg font-semibold">
                            Drop files to upload!
                          </p>
                        </div>
                      </div>
                    )}

                    <div
                      className={`transition-opacity duration-200 ${
                        isDragOver ? "opacity-30" : "opacity-100"
                      }`}
                    >
                      <Upload className="w-12 h-12 mx-auto mb-4 text-indigo-500 dark:text-indigo-400" />
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        Drag & Drop Files Here
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Or click the button below to browse files
                      </p>

                      {/* Supported formats info */}
                      <div className="flex flex-wrap justify-center gap-2 mb-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
                          📷 PNG, JPG, GIF, WebP
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                          🎬 MP4, MOV, AVI, WebM
                        </span>
                      </div>

                      <label
                        className={`inline-flex items-center space-x-3 px-6 py-3 rounded-xl font-medium cursor-pointer transition-all duration-200 ${
                          isUploadingMedia
                            ? "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        }`}
                      >
                        {isUploadingMedia ? (
                          <Loader className="w-5 h-5 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                        <span>
                          {isUploadingMedia
                            ? "🔄 Uploading..."
                            : "📤 Browse Files"}
                        </span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.webm,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/x-msvideo,video/webm"
                          multiple
                          onChange={handleExternalMediaUpload}
                          className="hidden"
                          disabled={isUploadingMedia}
                        />
                      </label>
                    </div>
                  </div>

                  {shareSettings.externalMedia.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                        📎 Uploaded Files ({shareSettings.externalMedia.length})
                      </h4>
                      {shareSettings.externalMedia.map((file, index) => {
                        const uploadStatus = getUploadStatus(file.name);
                        const failedUpload = failedUploads.find(
                          (failed) => failed.fileName === file.name
                        );

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 bg-white/60 dark:bg-gray-600/60 border border-gray-200 dark:border-gray-600 rounded-xl"
                          >
                            <div className="flex items-center space-x-3">
                              {/* Enhanced File Preview */}
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 relative">
                                {file.type.startsWith("image/") ? (
                                  <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                    onClick={() => {
                                      window.open(
                                        URL.createObjectURL(file),
                                        "_blank"
                                      );
                                    }}
                                  />
                                ) : file.type.startsWith("video/") ? (
                                  <video
                                    src={URL.createObjectURL(file)}
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={() => {
                                      window.open(
                                        URL.createObjectURL(file),
                                        "_blank"
                                      );
                                    }}
                                  >
                                    <Video className="w-6 h-6 text-gray-400" />
                                  </video>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Upload className="w-6 h-6 text-gray-400" />
                                  </div>
                                )}

                                {/* Progress overlay for uploading files */}
                                {uploadStatus.isUploading && (
                                  <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center backdrop-blur-sm">
                                    <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                                  </div>
                                )}
                              </div>

                              {/* Enhanced Upload Status Icon */}
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  uploadStatus.isUploaded
                                    ? "bg-green-100 dark:bg-green-900/20"
                                    : uploadStatus.hasFailed
                                    ? "bg-red-100 dark:bg-red-900/20"
                                    : uploadStatus.isUploading
                                    ? "bg-blue-100 dark:bg-blue-900/20"
                                    : "bg-yellow-100 dark:bg-yellow-900/20"
                                }`}
                              >
                                {uploadStatus.isUploaded ? (
                                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                ) : uploadStatus.hasFailed ? (
                                  <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                                ) : uploadStatus.isUploading ? (
                                  <Loader className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                                ) : (
                                  <Upload className="w-4 h-4 text-yellow-600 dark:text-yellow-400 animate-pulse" />
                                )}
                              </div>

                              {/* Enhanced File Info */}
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 block truncate">
                                  {file.name}
                                </span>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </span>
                                  {uploadStatus.isUploaded ? (
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                      ✅ Uploaded to LinkedIn
                                    </p>
                                  ) : uploadStatus.hasFailed ? (
                                    <div className="flex items-center space-x-2">
                                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                        ❌{" "}
                                        {failedUpload?.error || "Upload failed"}
                                      </p>
                                      {failedUpload &&
                                        failedUpload.retryCount < 3 && (
                                          <button
                                            onClick={() =>
                                              retryUpload(file.name)
                                            }
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
                                          >
                                            🔄 Retry (
                                            {failedUpload.retryCount + 1}/3)
                                          </button>
                                        )}
                                    </div>
                                  ) : uploadStatus.isUploading ? (
                                    <div className="flex items-center space-x-2">
                                      <p className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                                        🔄 Uploading... {uploadStatus.progress}%
                                      </p>
                                      <div className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-blue-500 transition-all duration-300"
                                          style={{
                                            width: `${uploadStatus.progress}%`,
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400 animate-pulse">
                                      ⏳ Upload pending...
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeExternalMedia(index)}
                              className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                              title="Remove file"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}

                      {/* Mixed Media Warning */}
                      {hasMixedMedia() && (
                        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <h5 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2 flex items-center">
                            ⚠️ Mixed Media Detected
                          </h5>
                          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                            You have uploaded both videos and images. Due to
                            LinkedIn&apos;s limitations, only{" "}
                            <strong>videos</strong> will be shown in your post.
                            Images will be ignored. For best results, create
                            separate posts for videos and images.
                          </p>
                        </div>
                      )}

                      {/* Failed Uploads Summary */}
                      {failedUploads.length > 0 && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <h5 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                            ⚠️ Upload Issues ({failedUploads.length})
                          </h5>
                          <div className="space-y-1">
                            {failedUploads.map((failed, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-red-700 dark:text-red-400">
                                  {failed.fileName}: {failed.error}
                                </span>
                                {failed.retryCount < 3 && (
                                  <button
                                    onClick={() => retryUpload(failed.fileName)}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline ml-2"
                                  >
                                    🔄 Retry
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Hashtags */}
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm border border-white/20 dark:border-gray-600/20 rounded-xl p-6 shadow-lg">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <Hash className="w-4 h-4 text-white" />
                  </div>
                  <label className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    🏷️ Hashtags
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {shareSettings.hashtags.map((hashtag, index) => (
                    <span
                      key={`${hashtag}-${index}`}
                      className="inline-flex items-center px-4 py-2 rounded-full text-sm bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:from-blue-200 hover:to-cyan-200 dark:hover:from-blue-900/40 dark:hover:to-cyan-900/40 transition-all duration-200"
                    >
                      {hashtag}
                      <button
                        onClick={() => removeHashtag(hashtag)}
                        className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/20 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add custom hashtag */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      placeholder="✨ Add custom hashtag (e.g., #react)"
                      className="flex-1 px-4 py-3 text-sm bg-white/80 dark:bg-gray-700/80 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-200"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          let hashtag = input.value.trim();

                          if (hashtag) {
                            // Add # if not present
                            if (!hashtag.startsWith("#")) {
                              hashtag = "#" + hashtag;
                            }

                            // Check for duplicates (case insensitive)
                            const isDuplicate = shareSettings.hashtags.some(
                              (existing) =>
                                existing.toLowerCase() === hashtag.toLowerCase()
                            );

                            if (
                              !isDuplicate &&
                              shareSettings.hashtags.length < 10
                            ) {
                              addHashtag(hashtag);
                              input.value = "";
                            }
                          }
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = (e.target as HTMLButtonElement)
                          .previousElementSibling as HTMLInputElement;
                        let hashtag = input.value.trim();

                        if (hashtag) {
                          // Add # if not present
                          if (!hashtag.startsWith("#")) {
                            hashtag = "#" + hashtag;
                          }

                          // Check for duplicates (case insensitive)
                          const isDuplicate = shareSettings.hashtags.some(
                            (existing) =>
                              existing.toLowerCase() === hashtag.toLowerCase()
                          );

                          if (
                            !isDuplicate &&
                            shareSettings.hashtags.length < 10
                          ) {
                            addHashtag(hashtag);
                            input.value = "";
                          }
                        }
                      }}
                      disabled={shareSettings.hashtags.length >= 10}
                      className="px-4 py-3 text-sm bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-900/50 dark:to-cyan-900/50 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 dark:hover:from-blue-900/70 dark:hover:to-cyan-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                    >
                      ➕ Add
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <p>Press Enter or click Add to include hashtag</p>
                    <p
                      className={`font-medium ${
                        shareSettings.hashtags.length >= 8
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {shareSettings.hashtags.length}/10 hashtags
                    </p>
                  </div>
                </div>

                {/* Suggested hashtags */}
                <div className="bg-gray-50/80 dark:bg-gray-900/20 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    💡 Suggested hashtags:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "#opensource",
                      "#coding",
                      "#developer",
                      "#github",
                      "#tech",
                      "#programming",
                      "#software",
                      "#webdev",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => addHashtag(suggestion)}
                        disabled={
                          shareSettings.hashtags.some(
                            (existing) =>
                              existing.toLowerCase() ===
                              suggestion.toLowerCase()
                          ) || shareSettings.hashtags.length >= 10
                        }
                        className="px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visibility */}
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm border border-white/20 dark:border-gray-600/20 rounded-xl p-6 shadow-lg">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">👁️</span>
                  </div>
                  <label className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    🌐 Post Visibility
                  </label>
                </div>

                <select
                  value={shareSettings.visibility}
                  onChange={(e) =>
                    setShareSettings((prev) => ({
                      ...prev,
                      visibility: e.target.value as "PUBLIC" | "CONNECTIONS",
                    }))
                  }
                  className="w-full px-4 py-3 bg-white/80 dark:bg-gray-700/80 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-green-500 dark:focus:border-green-400 transition-all duration-200 font-medium"
                >
                  <option value="PUBLIC">🌍 Public (Anyone can see)</option>
                  <option value="CONNECTIONS">👥 Connections only</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isQuickShare && !isGenerating && generatedPost && (
          <div className="flex items-center justify-between p-6 border-t border-white/30 dark:border-gray-700/30 bg-gradient-to-r from-white/80 to-white/60 dark:from-gray-800/80 dark:to-gray-800/60 backdrop-blur-sm rounded-b-xl">
            <button
              onClick={onClose}
              className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl hover:bg-white/90 dark:hover:bg-gray-700/90 transition-all duration-200 border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 font-medium flex items-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleCustomGenerate}
                disabled={isSharing}
                className="px-5 py-3 text-blue-700 dark:text-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/50 dark:to-indigo-900/50 backdrop-blur-sm rounded-xl hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/70 dark:hover:to-indigo-900/70 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2 border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 font-medium"
              >
                <Edit3 className="w-4 h-4" />
                <span>🔄 Regenerate</span>
              </button>

              <button
                onClick={() => handleShare()}
                disabled={isSharing || !customContent.trim()}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 backdrop-blur-sm text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2 border-2 border-blue-500/20 dark:border-blue-400/20 shadow-lg hover:shadow-xl font-medium"
              >
                {isSharing ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Share className="w-4 h-4" />
                )}
                <span>
                  {isSharing ? "🚀 Sharing..." : "🚀 Share on LinkedIn"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareModal;
