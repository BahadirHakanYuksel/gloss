import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// Define interfaces for type safety
interface MediaFile {
  name: string;
  path: string;
  download_url: string;
  size: number;
  extension: string;
  html_url?: string;
  accessible?: boolean;
  contentType?: string;
  contentLength?: string;
  accessError?: string;
}

interface GitHubFileResponse {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url?: string;
  size?: number;
  html_url?: string;
}

interface DirectoryScanned {
  path: string;
  status: "success" | "error";
  fileCount?: number;
  statusCode?: number;
  error?: string;
}

interface APIError {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
  code?: string;
}

interface MediaTestResults {
  repository: string;
  mediaFound: {
    images: MediaFile[];
    videos: MediaFile[];
    documents: MediaFile[];
  };
  directoriesScanned: DirectoryScanned[];
  errors: DirectoryScanned[];
  recommendations: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { accessToken, username, repository } = await request.json();

    if (!username || !repository) {
      return NextResponse.json(
        { error: "GitHub username and repository are required" },
        { status: 400 }
      );
    }

    console.log(`Testing media fetch for ${username}/${repository}`);

    const results: MediaTestResults = {
      repository: `${username}/${repository}`,
      mediaFound: {
        images: [],
        videos: [],
        documents: [],
      },
      directoriesScanned: [],
      errors: [],
      recommendations: [],
    };

    // Directories to scan for media
    const dirsToScan = [
      "",
      "images",
      "assets",
      "public",
      "static",
      "media",
      "screenshots",
      "docs",
    ];

    for (const dir of dirsToScan) {
      const url = `https://api.github.com/repos/${username}/${repository}/contents/${dir}`;
      console.log(`Scanning directory: ${dir || "root"} - ${url}`);

      // Try with token first if available, then without for public repos
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "GLOSS-App",
      };

      if (accessToken && accessToken !== "test" && accessToken !== "") {
        headers["Authorization"] = `token ${accessToken}`;
      }

      try {
        const response = await axios.get(url, {
          headers,
          timeout: 10000,
        });

        results.directoriesScanned.push({
          path: dir || "root",
          status: "success",
          fileCount: Array.isArray(response.data) ? response.data.length : 0,
        });

        if (Array.isArray(response.data)) {
          response.data.forEach((file: GitHubFileResponse) => {
            if (file.type === "file") {
              const extension = file.name.split(".").pop()?.toLowerCase();

              console.log(
                `Found file: ${file.name} (${extension}) - ${file.download_url}`
              );

              if (
                ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff"].includes(
                  extension || ""
                )
              ) {
                results.mediaFound.images.push({
                  name: file.name,
                  path: file.path,
                  download_url: file.download_url || "",
                  size: file.size || 0,
                  extension: extension || "",
                  html_url: file.html_url,
                });
              } else if (extension === "svg") {
                // SVG files are not supported by LinkedIn
                results.recommendations.push(
                  `SVG file ${file.name} found but not supported by LinkedIn (use PNG/JPG instead)`
                );
              } else if (
                ["mp4", "avi", "mov", "webm", "mkv", "flv"].includes(
                  extension || ""
                )
              ) {
                results.mediaFound.videos.push({
                  name: file.name,
                  path: file.path,
                  download_url: file.download_url || "",
                  size: file.size || 0,
                  extension: extension || "",
                  html_url: file.html_url,
                });
              } else if (
                ["pdf", "doc", "docx", "txt", "md", "readme"].includes(
                  extension || ""
                )
              ) {
                results.mediaFound.documents.push({
                  name: file.name,
                  path: file.path,
                  download_url: file.download_url || "",
                  size: file.size || 0,
                  extension: extension || "",
                  html_url: file.html_url,
                });
              }
            }
          });
        }
      } catch (error: unknown) {
        let finalError = error as APIError;

        // If authentication failed and we're using a token, try without token for public repos
        if (finalError.response?.status === 401 && headers["Authorization"]) {
          try {
            console.log(
              `Retrying ${dir || "root"} without authentication for public repo`
            );
            const publicHeaders = {
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "GLOSS-App",
            };

            const retryResponse = await axios.get(url, {
              headers: publicHeaders,
              timeout: 10000,
            });

            results.directoriesScanned.push({
              path: dir || "root",
              status: "success",
              fileCount: Array.isArray(retryResponse.data)
                ? retryResponse.data.length
                : 0,
            });

            if (Array.isArray(retryResponse.data)) {
              retryResponse.data.forEach((file: GitHubFileResponse) => {
                if (file.type === "file") {
                  const extension = file.name.split(".").pop()?.toLowerCase();

                  console.log(
                    `Found file: ${file.name} (${extension}) - ${file.download_url}`
                  );

                  if (
                    [
                      "jpg",
                      "jpeg",
                      "png",
                      "gif",
                      "webp",
                      "bmp",
                      "tiff",
                    ].includes(extension || "")
                  ) {
                    results.mediaFound.images.push({
                      name: file.name,
                      path: file.path,
                      download_url: file.download_url || "",
                      size: file.size || 0,
                      extension: extension || "",
                      html_url: file.html_url,
                    });
                  } else if (extension === "svg") {
                    // SVG files are not supported by LinkedIn
                    results.recommendations.push(
                      `SVG file ${file.name} found but not supported by LinkedIn (use PNG/JPG instead)`
                    );
                  } else if (
                    ["mp4", "avi", "mov", "webm", "mkv", "flv"].includes(
                      extension || ""
                    )
                  ) {
                    results.mediaFound.videos.push({
                      name: file.name,
                      path: file.path,
                      download_url: file.download_url || "",
                      size: file.size || 0,
                      extension: extension || "",
                      html_url: file.html_url,
                    });
                  } else if (
                    ["pdf", "doc", "docx", "txt", "md", "readme"].includes(
                      extension || ""
                    )
                  ) {
                    results.mediaFound.documents.push({
                      name: file.name,
                      path: file.path,
                      download_url: file.download_url || "",
                      size: file.size || 0,
                      extension: extension || "",
                      html_url: file.html_url,
                    });
                  }
                }
              });
            }

            // Skip error logging since retry was successful
            continue;
          } catch (retryError: unknown) {
            finalError = retryError as APIError;
          }
        }

        const errorInfo: DirectoryScanned = {
          path: dir || "root",
          status: "error",
          statusCode: finalError.response?.status || 0,
          error: finalError.response?.data?.message || finalError.message,
        };

        results.errors.push(errorInfo);

        if (finalError.response?.status === 404) {
          console.log(
            `Directory ${dir || "root"} not found (404) - this is normal`
          );
        } else {
          console.error(`Error scanning ${dir || "root"}:`, errorInfo);
        }
      }
    }

    // Test image accessibility
    if (results.mediaFound.images.length > 0) {
      console.log("Testing image accessibility...");

      for (const image of results.mediaFound.images.slice(0, 3)) {
        // Test first 3 images
        try {
          const imageResponse = await axios.head(image.download_url, {
            timeout: 5000,
          });

          image.accessible = true;
          image.contentType = imageResponse.headers["content-type"];
          image.contentLength = imageResponse.headers["content-length"];
        } catch (imageError: unknown) {
          const typedImageError = imageError as APIError;
          image.accessible = false;
          image.accessError = typedImageError.message;

          results.recommendations.push(
            `Image ${image.name} may not be accessible: ${typedImageError.message}`
          );
        }
      }
    }

    // Generate recommendations
    if (results.mediaFound.images.length === 0) {
      results.recommendations.push(
        "No images found in common directories. Check if images are in other folders."
      );
    }

    if (results.errors.length > results.directoriesScanned.length / 2) {
      results.recommendations.push(
        "Many directory access errors. Check if the repository is public and token has correct permissions."
      );
    }

    const totalMedia =
      results.mediaFound.images.length +
      results.mediaFound.videos.length +
      results.mediaFound.documents.length;

    return NextResponse.json({
      success: true,
      results: results,
      summary: {
        totalDirectoriesScanned: results.directoriesScanned.length,
        totalErrors: results.errors.length,
        totalMediaFound: totalMedia,
        imageCount: results.mediaFound.images.length,
        videoCount: results.mediaFound.videos.length,
        documentCount: results.mediaFound.documents.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Media test error:", error);
    const typedError = error as APIError;

    return NextResponse.json(
      {
        error: "Media test failed",
        details: typedError.message,
      },
      { status: 500 }
    );
  }
}
