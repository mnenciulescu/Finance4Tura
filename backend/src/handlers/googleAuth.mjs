import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { randomBytes } from "crypto";

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

// A fresh random password for every sign-in, set immediately before it is used
// and never stored anywhere.
//
// This replaces a scheme that derived the password from a shared secret and the
// Google sub. That made every federated user's password reproducible by anyone
// holding the secret, and a Google sub is an identifier, not a credential —
// so the pair was enough to sign in as that user. Nothing here is derivable.
function freshPassword() {
  return "Gp#" + randomBytes(32).toString("base64url");
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  try {
    const { idToken } = JSON.parse(event.body || "{}");
    if (!idToken) throw new Error("idToken is required");

    const { sub, email, name } = await verifyGoogleToken(idToken);
    const username = `google_${sub}`;

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
    }

    // Rotate the password on every sign-in, for new and existing users alike.
    // For an existing user this overwrites whatever was there — including a
    // password derived under the old shared-secret scheme.
    const authenticate = async () => {
      const password = freshPassword();
      await cognito.send(new AdminSetUserPasswordCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username:   username,
        Password:   password,
        Permanent:  true,
      }));
      return cognito.send(new AdminInitiateAuthCommand({
        UserPoolId:     process.env.USER_POOL_ID,
        ClientId:       process.env.CLIENT_ID,
        AuthFlow:       "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: username, PASSWORD: password },
      }));
    };

    // Two sign-ins racing for the same user can interleave so that one sets a
    // password the other immediately replaces. Retrying once resolves it.
    let auth;
    try {
      auth = await authenticate();
    } catch (e) {
      if (e.name !== "NotAuthorizedException") throw e;
      auth = await authenticate();
    }

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
