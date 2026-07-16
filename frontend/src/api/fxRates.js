import client from "./client";

// Shared FX rates (base EUR), stored in DynamoDB.
export const getFxRates    = () => client.get("/fx-rates").then(r => r.data);   // { rates, updatedAt }
export const updateFxRates = () => client.post("/fx-rates").then(r => r.data);  // admin only → { rates, updatedAt, log }
