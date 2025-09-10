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
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: "LinkedIn access token is required" },
        { status: 400 }
      );
    }

    console.log("=== LinkedIn Author URN Request ===");

    // Try multiple endpoints to get user profile
    let authorUrn = null;
    const endpoints = [
      "https://api.linkedin.com/v2/userinfo",
      "https://api.linkedin.com/v2/me",
      "https://api.linkedin.com/v2/people/~",
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Attempting to get profile from: ${endpoint}`);

        const profileResponse = await axios.get(endpoint, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          timeout: 15000,
        });

        console.log(`Profile response from ${endpoint}:`, {
          status: profileResponse.status,
          data: profileResponse.data,
        });

        let userId = null;
        if (profileResponse.data.sub) {
          userId = profileResponse.data.sub;
        } else if (profileResponse.data.id) {
          userId = profileResponse.data.id;
        }

        if (userId) {
          authorUrn = `urn:li:person:${userId}`;
          console.log("✅ Author URN obtained:", authorUrn);
          break;
        }
      } catch (error: unknown) {
        const typedError = error as APIError;
        console.warn(`❌ Failed to get profile from ${endpoint}:`, {
          message: typedError.message,
          status: typedError.response?.status,
          data: typedError.response?.data,
        });

        // If 403, log specific troubleshooting info
        if (typedError.response?.status === 403) {
          console.error(`🚫 403 Forbidden for ${endpoint}:`, {
            error: typedError.response?.data,
            suggestion:
              "Check token scopes: w_member_social, r_liteprofile required",
          });
        }

        continue;
      }
    }

    if (!authorUrn) {
      console.error(
        "🚫 Failed to get LinkedIn user profile from all endpoints"
      );
      return NextResponse.json(
        {
          error: "Failed to get LinkedIn user profile",
          details:
            "Unable to retrieve user information from LinkedIn API. Please check your access token and permissions.",
          troubleshooting: {
            requiredScopes: ["w_member_social", "r_liteprofile"],
            endpointsTried: endpoints,
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      authorUrn: authorUrn,
    });
  } catch (error: unknown) {
    const typedError = error as APIError;
    console.error("=== LinkedIn Author URN Error ===");
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
          details: "Token lacks required permissions",
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

    return NextResponse.json(
      {
        error:
          typedError.response?.data?.message ||
          typedError.message ||
          "Failed to get author URN",
        details: typedError.response?.data,
      },
      { status: typedError.response?.status || 500 }
    );
  }
}
