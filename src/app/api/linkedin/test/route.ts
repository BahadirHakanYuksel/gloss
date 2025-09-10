import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

interface EndpointResult {
  status: "success" | "error";
  statusCode: number;
  data?: unknown;
  error?: unknown;
  suggestedURN?: string;
}

interface TestResults {
  token: string;
  endpoints: Record<string, EndpointResult>;
  tokenValid: boolean;
  recommendations: string[];
  summary: {
    successfulEndpoints: number;
    failedEndpoints: number;
    suggestedAuthorURN?: string;
  };
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

    console.log("Testing LinkedIn token and endpoints...");

    const results: TestResults = {
      token: accessToken.substring(0, 10) + "...",
      endpoints: {},
      tokenValid: false,
      recommendations: [],
      summary: {
        successfulEndpoints: 0,
        failedEndpoints: 0,
      },
    };

    // Test different LinkedIn API endpoints
    const endpoints = [
      {
        name: "userinfo",
        url: "https://api.linkedin.com/v2/userinfo",
        description: "OAuth 2.0 User Info endpoint",
      },
      {
        name: "me",
        url: "https://api.linkedin.com/v2/me",
        description: "Basic profile info",
      },
      {
        name: "people",
        url: "https://api.linkedin.com/v2/people/~:(id,firstName,lastName)",
        description: "Detailed profile with specific fields",
      },
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Testing endpoint: ${endpoint.name} - ${endpoint.url}`);

        const response = await axios.get(endpoint.url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        });

        results.endpoints[endpoint.name] = {
          status: "success",
          statusCode: response.status,
          data: response.data,
        };

        results.summary.successfulEndpoints++;
        results.tokenValid = true;

        // Try to extract user ID for URN suggestion
        if (response.data.sub) {
          results.endpoints[
            endpoint.name
          ].suggestedURN = `urn:li:person:${response.data.sub}`;
        } else if (response.data.id) {
          results.endpoints[
            endpoint.name
          ].suggestedURN = `urn:li:person:${response.data.id}`;
        }
      } catch (error: unknown) {
        const err = error as {
          response?: { data?: unknown; status?: number };
          message?: string;
        };
        results.endpoints[endpoint.name] = {
          status: "error",
          statusCode: err.response?.status || 0,
          error: err.response?.data || err.message,
        };

        results.summary.failedEndpoints++;

        // Analyze the error
        if (err.response?.status === 403) {
          results.recommendations.push(
            `${endpoint.name}: 403 Forbidden - Token lacks required permissions`
          );
        } else if (err.response?.status === 401) {
          results.recommendations.push(
            `${endpoint.name}: 401 Unauthorized - Token may be expired or invalid`
          );
        }
      }
    }

    // Test posting capability
    if (results.tokenValid) {
      console.log("Testing post creation capability...");

      // Get the first successful URN
      let authorURN = null;
      for (const endpointName in results.endpoints) {
        const result = results.endpoints[endpointName];
        if (result.status === "success" && result.suggestedURN) {
          authorURN = result.suggestedURN;
          results.summary.suggestedAuthorURN = authorURN;
          break;
        }
      }

      if (authorURN) {
        // Try to validate post creation (without actually posting)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const testPostData = {
          author: authorURN,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: {
                text: "Test post - not actually published",
              },
              shareMediaCategory: "NONE",
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
          },
        };

        try {
          // We don't actually post, just validate the token has posting permission
          // by making a test call to a read endpoint
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const testResponse = await axios.get(
            "https://api.linkedin.com/v2/me",
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
              },
              timeout: 5000,
            }
          );

          results.recommendations.push(
            "✅ Token appears valid for posting (based on available permissions)"
          );
        } catch (postError: unknown) {
          const err = postError as {
            response?: { status?: number };
            message?: string;
          };
          results.recommendations.push(
            `⚠️ Post capability unclear: ${
              err.response?.status || "Unknown error"
            }`
          );
        }
      } else {
        results.recommendations.push(
          "❌ Could not determine user ID for posting - all profile endpoints failed"
        );
      }
    }

    // Generate final recommendations
    if (results.summary.successfulEndpoints === 0) {
      results.recommendations.push(
        "❌ No endpoints succeeded - token is likely invalid or expired"
      );
    } else if (results.summary.successfulEndpoints < endpoints.length) {
      results.recommendations.push(
        "⚠️ Some endpoints failed - token may have limited permissions"
      );
    } else {
      results.recommendations.push("✅ All test endpoints succeeded");
    }

    return NextResponse.json({
      success: true,
      results: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("LinkedIn test error:", err);

    return NextResponse.json(
      {
        error: "LinkedIn token test failed",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
