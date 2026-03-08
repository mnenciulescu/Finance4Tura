import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac } from "crypto";

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "eu-central-1" });

const CORS = {
  "Content-Type":                "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":"Content-Type,Authorization",
  "Cache-Control":               "no-store",
};

// Verify the Google ID token using Google's public tokeninfo endpoint
async function verifyGoogleToken(idToken) {
  const res  = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error_description || "Invalid Google token");
  if (process.env.GOOGLE_CLIENT_ID && data.aud !== process.env.GOOGLE_CLIENT_ID)
    throw new Error("Token audience mismatch");
  return data; // { sub, email, name, picture, ... }
}

// Derive a stable strong password from the Google sub so we never store it
function derivePassword(sub) {
  return "Gp#" + createHmac("sha256", process.env.GOOGLE_SECRET).update(sub).digest("base64url");
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  try {
    const { idToken } = JSON.parse(event.body || "{}");
    if (!idToken) throw new Error("idToken is required");

    const { sub, email, name } = await verifyGoogleToken(idToken);
    const username = `google_${sub}`;
    const password = derivePassword(sub);

    // Create Cognito user on first sign-in
    let userExists = true;
    try {
      await cognito.send(new AdminGetUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username:   username,
      }));
    } catch (e) {
      if (e.name !== "UserNotFoundException") throw e;
      userExists = false;
    }

    if (!userExists) {
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId:     process.env.USER_POOL_ID,
        Username:       username,
        UserAttributes: [
          { Name: "email",          Value: email },
          { Name: "email_verified", Value: "true" },
          ...(name ? [{ Name: "name", Value: name }] : []),
        ],
        MessageAction: "SUPPRESS",
      }));
      await cognito.send(new AdminSetUserPasswordCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username:   username,
        Password:   password,
        Permanent:  true,
      }));
    }

    // Authenticate and get Cognito tokens
    const auth = await cognito.send(new AdminInitiateAuthCommand({
      UserPoolId:       process.env.USER_POOL_ID,
      ClientId:         process.env.CLIENT_ID,
      AuthFlow:         "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters:   { USERNAME: username, PASSWORD: password },
    }));

    const { IdToken, AccessToken, RefreshToken } = auth.AuthenticationResult;
    return {
      statusCode: 200,
      headers:    CORS,
      body:       JSON.stringify({ idToken: IdToken, accessToken: AccessToken, refreshToken: RefreshToken, username }),
    };
  } catch (err) {
    console.error("googleAuth error:", err);
    return {
      statusCode: 401,
      headers:    CORS,
      body:       JSON.stringify({ message: err.message || "Authentication failed" }),
    };
  }
};
