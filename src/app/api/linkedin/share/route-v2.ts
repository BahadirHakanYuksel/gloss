import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function POST(request: NextRequest) {
  try {
    const { content, media, accessToken } = await request.json();

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
        const err = error as {
          response?: { data?: unknown; status?: number };
          message?: string;
        };
        console.warn(
          `Failed to get profile from ${endpoint}:`,
          err.response?.data || err.message
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

    // Prepare the post data exactly like your working example
    const postData = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: media && media.length > 0 ? "IMAGE" : "NONE",
          ...(media &&
            media.length > 0 && {
              media: media.map((url: string) => ({
                status: "READY",
                description: {
                  text: "Shared from GitHub project",
                },
                originalUrl: url,
                title: {
                  text: "Project Media",
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
    const err = error as {
      response?: { data?: { message?: string }; status?: number };
      message?: string;
      config?: { url?: string };
    };
    console.error("LinkedIn API error:", err.response?.data || err.message);
    console.error("Error status:", err.response?.status);
    console.error("Error config:", err.config?.url);

    return NextResponse.json(
      {
        error:
          err.response?.data?.message ||
          err.message ||
          "LinkedIn sharing failed",
        details: err.response?.data,
        status: err.response?.status,
      },
      { status: err.response?.status || 500 }
    );
  }
}
