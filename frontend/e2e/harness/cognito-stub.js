// Stand-in for amazon-cognito-identity-js: a signed-in user with a valid session.
const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3 * 3600, "cognito:groups": ["admin"] }));
const jwt = `x.${payload}.y`;
const session = { isValid: () => true, getIdToken: () => ({ getJwtToken: () => jwt }) };
class CognitoUserImpl {
  constructor(name = "nenciulescu") { this.name = name; }
  getUsername() { return this.name; }
  getSession(cb) { cb(null, session); }
  signOut() {}
  authenticateUser(_d, cbs) { cbs.onSuccess(session); }
}
export class CognitoUserPool {
  getCurrentUser() { return localStorage.getItem("preview-signed-out") ? null : new CognitoUserImpl(); }
  signUp(_u, _p, _a, _v, cb) { cb(null, {}); }
}
export class CognitoUser extends CognitoUserImpl { constructor(o) { super(o?.Username); } }
export class AuthenticationDetails { constructor() {} }
