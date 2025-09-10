import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// Define interface for uploaded media assets
interface MediaAsset {
  assetId: string;
  fileName: string;
  fileSize: number;
  fileType?: string; // Original MIME type
  mediaType: string; // LinkedIn media type
  category?: string; // FILE category (IMAGE/VIDEO)
  originalUrl?: string;
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
  config?: {
    url?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { content, media, mediaAssets, accessToken } = await request.json();

    console.log("=== LinkedIn Share Debug ===");
    console.log("Content length:", content?.length);
    console.log("Media array (URLs):", media);
    console.log("Media assets (uploaded):", mediaAssets);
    console.log("Access token present:", !!accessToken);

    if (!accessToken) {
      return NextResponse.json(
        { error: "LinkedIn access token is required" },
        { status: 400 }
      );
    }

    console.log("LinkedIn API request from server...");

    // Get the user's profile to construct proper URN
    let authorUrn = null;

    // Try multiple endpoints to get the user ID
    const endpoints = [
      "https://api.linkedin.com/v2/userinfo",
      "https://api.linkedin.com/v2/me",
      "https://api.linkedin.com/v2/people/~:(id)",
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const profileResponse = await axios.get(endpoint, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        });

        console.log(`Response from ${endpoint}:`, profileResponse.data);

        // Different endpoints return different field names
        let userId = null;
        if (profileResponse.data.sub) {
          userId = profileResponse.data.sub; // userinfo endpoint
        } else if (profileResponse.data.id) {
          userId = profileResponse.data.id; // people endpoint
        }

        if (userId) {
          authorUrn = `urn:li:person:${userId}`;
          console.log("Successfully got author URN:", authorUrn);
          break;
        }
      } catch (error: unknown) {
        const typedError = error as APIError;
        console.warn(
          `Failed to get profile from ${endpoint}:`,
          typedError.response?.data || typedError.message
        );
        continue;
      }
    }

    if (!authorUrn) {
      console.error("All profile endpoints failed");
      return NextResponse.json(
        {
          error:
            "Failed to get LinkedIn user profile. Please check your access token and permissions.",
          details: "Could not fetch user ID from any LinkedIn endpoint",
        },
        { status: 401 }
      );
    }

    // Prepare the post data exactly like the Microsoft documentation
    const hasMediaAssets = mediaAssets && mediaAssets.length > 0;

    // Determine media category based on uploaded assets
    let shareMediaCategory = "NONE";
    let filteredMediaAssets: MediaAsset[] = [];

    if (hasMediaAssets) {
      // Use category field if available, otherwise fall back to mediaType
      const videos = mediaAssets.filter(
        (asset: MediaAsset) =>
          asset.category === "VIDEO" ||
          asset.mediaType === "feedshare-video" ||
          (asset.fileType && asset.fileType.startsWith("video/"))
      );

      const images = mediaAssets.filter(
        (asset: MediaAsset) =>
          asset.category === "IMAGE" ||
          asset.mediaType === "feedshare-image" ||
          (asset.fileType && asset.fileType.startsWith("image/"))
      );

      console.log(
        `📊 Media breakdown: ${images.length} images, ${videos.length} videos`
      );
      console.log(
        "📷 Images:",
        images.map((img: MediaAsset) => ({
          name: img.fileName,
          type: img.mediaType,
          category: img.category,
        }))
      );
      console.log(
        "🎬 Videos:",
        videos.map((vid: MediaAsset) => ({
          name: vid.fileName,
          type: vid.mediaType,
          category: vid.category,
        }))
      );

      // LinkedIn mixed media strategy: Prioritize videos over images
      if (videos.length > 0 && images.length > 0) {
        console.log(
          "⚠️ Mixed media detected. LinkedIn doesn't support video+image in same post."
        );
        console.log("🎯 Strategy: Using VIDEO only (LinkedIn limitation)");
        shareMediaCategory = "VIDEO";
        filteredMediaAssets = videos; // Only use videos
      } else if (videos.length > 0) {
        shareMediaCategory = "VIDEO";
        filteredMediaAssets = videos;
      } else if (images.length > 0) {
        shareMediaCategory = "IMAGE";
        filteredMediaAssets = images;
      }
    }

    console.log("Media category determined:", shareMediaCategory);
    console.log(
      "Media assets breakdown:",
      mediaAssets?.map((asset: MediaAsset) => ({
        fileName: asset.fileName,
        mediaType: asset.mediaType,
      }))
    );
    console.log(
      "🎯 Filtered assets for LinkedIn:",
      filteredMediaAssets.map((asset) => asset.fileName)
    );

    const postData = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: shareMediaCategory,
          ...(filteredMediaAssets.length > 0 && {
            media: filteredMediaAssets.map((asset: MediaAsset) => ({
              status: "READY",
              description: {
                text: `Uploaded file: ${asset.fileName}`,
              },
              media: asset.assetId,
              title: {
                text: asset.fileName,
              },
            })),
          }),
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    console.log("Post data prepared:", JSON.stringify(postData, null, 2));

    if (hasMediaAssets) {
      console.log("Including uploaded media assets in post");
    } else {
      console.log("Sharing text only (no media assets)");
    }

    console.log("Making LinkedIn API call...");

    // Make the LinkedIn API call exactly like your working example
    const response = await axios.post(
      "https://api.linkedin.com/v2/ugcPosts",
      postData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        timeout: 15000,
      }
    );

    console.log("LinkedIn API success:", response.data);
    console.log("Response headers:", response.headers);

    return NextResponse.json({
      success: true,
      data: {
        id: response.headers["x-restli-id"] || response.data.id,
        shareUrl: response.headers["x-restli-id"]
          ? `https://www.linkedin.com/feed/update/${response.headers["x-restli-id"]}`
          : "https://www.linkedin.com/feed/",
        response: response.data,
      },
    });
  } catch (error: unknown) {
    const typedError = error as APIError;
    console.error("=== LinkedIn API Error ===");
    console.error("Error message:", typedError.message);
    console.error("Error status:", typedError.response?.status);
    console.error("Error data:", typedError.response?.data);
    console.error("Error config URL:", typedError.config?.url);
    console.error("Full error:", typedError);

    // Handle specific LinkedIn API errors
    if (typedError.response?.status === 401) {
      return NextResponse.json(
        {
          error: "LinkedIn access token is invalid or expired",
          details: "Please update your LinkedIn access token",
          linkedinError: typedError.response?.data,
        },
        { status: 401 }
      );
    }

    if (typedError.response?.status === 400) {
      return NextResponse.json(
        {
          error: "LinkedIn API request format error",
          details: typedError.response?.data?.message || "Bad request format",
          linkedinError: typedError.response?.data,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          typedError.response?.data?.message ||
          typedError.message ||
          "LinkedIn sharing failed",
        details: typedError.response?.data,
        status: typedError.response?.status,
      },
      { status: typedError.response?.status || 500 }
    );
  }
}
