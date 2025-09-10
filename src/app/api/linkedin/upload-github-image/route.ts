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
    const { imageUrl, accessToken, fileName, authorUrn } = await request.json();

    if (!imageUrl || !accessToken) {
      return NextResponse.json(
        { error: "Image URL and LinkedIn access token are required" },
        { status: 400 }
      );
    }

    if (!authorUrn) {
      return NextResponse.json(
        { error: "LinkedIn author URN is required" },
        { status: 400 }
      );
    }

    // Validate authorUrn format
    if (!authorUrn.startsWith("urn:li:person:")) {
      return NextResponse.json(
        {
          error: "Invalid author URN format",
          details: "Author URN must be in format: urn:li:person:userId",
        },
        { status: 400 }
      );
    }

    console.log("=== GitHub Image Upload to LinkedIn ===");
    console.log("Image URL:", imageUrl);
    console.log("File name:", fileName);

    // Validate file format before downloading
    const fileExtension = fileName?.split(".").pop()?.toLowerCase();
    if (fileExtension === "svg") {
      return NextResponse.json(
        {
          error: "SVG files are not supported by LinkedIn",
          details: "Please use PNG, JPG, or GIF format instead",
        },
        { status: 400 }
      );
    }

    // Step 1: Download image from GitHub
    console.log("Downloading image from GitHub...");
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
    });

    const imageBuffer = Buffer.from(imageResponse.data);
    const contentType = imageResponse.headers["content-type"] || "image/jpeg";

    console.log("Image downloaded:", imageBuffer.length, "bytes");
    console.log("Content type:", contentType);

    // Validate downloaded image
    if (contentType.includes("svg")) {
      return NextResponse.json(
        {
          error: "SVG format detected and not supported by LinkedIn",
          details:
            "This image appears to be in SVG format which is not compatible with LinkedIn",
        },
        { status: 400 }
      );
    }

    // Validate file size (max 100MB)
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (imageBuffer.length > maxFileSize) {
      return NextResponse.json(
        {
          error: "Image too large",
          details: "Maximum image size is 100MB",
        },
        { status: 413 }
      );
    }

    console.log("✅ Using cached LinkedIn authorUrn:", authorUrn);

    // Step 3: Register upload with LinkedIn
    const registerData = {
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: authorUrn,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    };

    console.log("Registering upload with LinkedIn...");

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

    console.log("Upload URL received, asset ID:", assetId);

    // Step 4: Upload image to LinkedIn
    console.log("Uploading image to LinkedIn...");
    await axios.post(uploadUrl, imageBuffer, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": contentType,
      },
      timeout: 30000,
    });

    console.log("GitHub image successfully uploaded to LinkedIn");

    return NextResponse.json({
      success: true,
      data: {
        assetId: assetId,
        fileName: fileName,
        fileSize: imageBuffer.length,
        mediaType: "feedshare-image",
        originalUrl: imageUrl,
      },
    });
  } catch (error: unknown) {
    const typedError = error as APIError;
    console.error("=== GitHub Image Upload Error ===");
    console.error("Error message:", typedError.message);
    console.error("Error status:", typedError.response?.status);
    console.error("Error data:", typedError.response?.data);

    if (typedError.code === "ENOTFOUND" || typedError.code === "ECONNRESET") {
      return NextResponse.json(
        {
          error: "Failed to download image from GitHub",
          details: "Network error or image not accessible",
        },
        { status: 400 }
      );
    }

    if (typedError.response?.status === 401) {
      return NextResponse.json(
        {
          error: "LinkedIn access token is invalid or expired",
          details: "Please update your LinkedIn access token",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error:
          typedError.response?.data?.message ||
          typedError.message ||
          "Upload failed",
        details: typedError.response?.data,
      },
      { status: typedError.response?.status || 500 }
    );
  }
}
