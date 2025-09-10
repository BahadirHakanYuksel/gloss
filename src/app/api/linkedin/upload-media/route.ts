import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const accessToken = formData.get("accessToken") as string;
    const authorUrn = formData.get("authorUrn") as string; // Get pre-fetched authorUrn

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "LinkedIn access token is required" },
        { status: 400 }
      );
    }

    if (!authorUrn) {
      return NextResponse.json(
        { error: "LinkedIn author URN is required" },
        { status: 400 }
      );
    }

    console.log("=== LinkedIn Media Upload ===");
    console.log("File name:", file.name);
    console.log("File size:", file.size);
    console.log("File type:", file.type);
    console.log("Author URN (cached):", authorUrn);

    // Determine file category
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const fileCategory = isImage ? "IMAGE" : isVideo ? "VIDEO" : "UNKNOWN";

    console.log("📁 File category:", fileCategory);

    // Validate file format
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension === "svg") {
      return NextResponse.json(
        {
          error: "SVG files are not supported by LinkedIn",
          details: "Please use PNG, JPG, or GIF format instead",
        },
        { status: 400 }
      );
    }

    // Validate supported media formats
    const supportedImageFormats = ["jpg", "jpeg", "png", "gif", "webp"];
    const supportedVideoFormats = ["mp4", "mov", "avi", "webm"];

    if (
      file.type.startsWith("image/") &&
      !supportedImageFormats.includes(fileExtension || "")
    ) {
      return NextResponse.json(
        {
          error: "Unsupported image format",
          details: `Supported image formats: ${supportedImageFormats
            .join(", ")
            .toUpperCase()}`,
        },
        { status: 400 }
      );
    }

    if (
      file.type.startsWith("video/") &&
      !supportedVideoFormats.includes(fileExtension || "")
    ) {
      return NextResponse.json(
        {
          error: "Unsupported video format",
          details: `Supported video formats: ${supportedVideoFormats
            .join(", ")
            .toUpperCase()}`,
        },
        { status: 400 }
      );
    }

    // Validate file size based on media type
    const maxImageSize = 100 * 1024 * 1024; // 100MB for images
    const maxVideoSize = 5 * 1024 * 1024 * 1024; // 5GB for videos (LinkedIn limit)

    if (file.type.startsWith("image/") && file.size > maxImageSize) {
      return NextResponse.json(
        {
          error: "Image file too large",
          details: "Maximum image size is 100MB",
        },
        { status: 413 }
      );
    }

    if (file.type.startsWith("video/") && file.size > maxVideoSize) {
      return NextResponse.json(
        {
          error: "Video file too large",
          details: "Maximum video size is 5GB",
        },
        { status: 413 }
      );
    }

    // Validate authorUrn parameter
    if (!authorUrn.startsWith("urn:li:person:")) {
      return NextResponse.json(
        {
          error: "Invalid author URN format",
          details: "Author URN must be in format: urn:li:person:userId",
        },
        { status: 400 }
      );
    }

    console.log("✅ Using cached LinkedIn authorUrn:", authorUrn);

    // Step 2: Register upload
    const mediaType = file.type.startsWith("image/")
      ? "feedshare-image"
      : "feedshare-video";
    const registerData = {
      registerUploadRequest: {
        recipes: [`urn:li:digitalmediaRecipe:${mediaType}`],
        owner: authorUrn,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    };

    console.log("📱 Media type:", mediaType);
    console.log("🎯 File category:", fileCategory);
    console.log("Registering upload for:", mediaType);

    const registerResponse = await axios.post(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      registerData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        timeout: 15000,
      }
    );

    const uploadUrl =
      registerResponse.data.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;
    const assetId = registerResponse.data.value.asset;

    console.log("Upload URL received");
    console.log("Asset ID:", assetId);

    // Step 3: Upload binary file
    const fileBuffer = await file.arrayBuffer();
    const uploadResponse = await axios.post(uploadUrl, fileBuffer, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.type,
      },
      timeout: 30000, // 30 seconds for file upload
    });

    console.log("File uploaded successfully");
    console.log("Upload response status:", uploadResponse.status);

    const responseData = {
      assetId: assetId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type, // Original MIME type
      mediaType: mediaType, // LinkedIn media type
      category: fileCategory, // Explicit category
    };

    console.log("✅ Returning upload data:", responseData);

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error: unknown) {
    const typedError = error as APIError;
    console.error("=== LinkedIn Media Upload Error ===");
    console.error("Error message:", typedError.message);
    console.error("Error status:", typedError.response?.status);
    console.error("Error data:", typedError.response?.data);

    if (typedError.response?.status === 401) {
      return NextResponse.json(
        {
          error: "LinkedIn access token is invalid or expired",
          details: "Please update your LinkedIn access token",
          troubleshooting: {
            cause: "Token may be expired or have insufficient permissions",
            solution:
              "Generate a new token with w_member_social and r_liteprofile scopes",
          },
        },
        { status: 401 }
      );
    }

    if (typedError.response?.status === 403) {
      return NextResponse.json(
        {
          error: "LinkedIn API access forbidden",
          details: "Token lacks required permissions for media upload",
          troubleshooting: {
            cause: "Insufficient token scopes or API access restrictions",
            requiredScopes: ["w_member_social", "r_liteprofile"],
            solution:
              "Regenerate token with proper scopes or check LinkedIn API status",
          },
        },
        { status: 403 }
      );
    }

    if (typedError.response?.status === 413) {
      return NextResponse.json(
        {
          error: "File too large",
          details: "Please upload a smaller file (max 100MB)",
        },
        { status: 413 }
      );
    }

    return NextResponse.json(
      {
        error:
          typedError.response?.data?.message ||
          typedError.message ||
          "Media upload failed",
        details: typedError.response?.data,
      },
      { status: typedError.response?.status || 500 }
    );
  }
}
