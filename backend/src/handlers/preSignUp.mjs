// Cognito Pre Sign-Up trigger — auto-confirms all new users so they can
// sign in immediately without email verification.
export const handler = async (event) => {
  event.response.autoConfirmUser = true;
  return event;
};
