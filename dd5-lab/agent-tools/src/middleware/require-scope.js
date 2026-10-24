// Milestone 4: validates the access token and checks the action. It is NOT wired into any route yet (milestone 5 does that).
import jwt from "jsonwebtoken";

const BEARER = /^Bearer ([A-Za-z0-9._-]+)$/;

export function requireScope(action) {
  return (req, res, next) => {
    // Strict parse: the header must be exactly "Bearer <token>", not a string that merely contains it.
    const match = BEARER.exec(req.headers.authorization ?? "");
    if (!match) return res.status(401).json({ error: "invalid_token" });

    let payload;
    try {
      payload = jwt.verify(match[1], process.env.JWT_PUBLIC_KEY, {
        algorithms: ["RS256"], // pin the algorithm: never let the token choose it
        audience: "agent-tools",
        issuer: "https://auth.internal.bank/",
      });
    } catch (e) {
      return res.status(401).json({ error: "invalid_token" });
    }

    // A token must expire, and must be an access token if it says what it is.
    if (typeof payload.exp !== "number") return res.status(401).json({ error: "invalid_token" });
    if (payload.token_use !== undefined && payload.token_use !== "access") return res.status(401).json({ error: "invalid_token" });

    // From here the token is verified, even if it turns out not to allow this action. Share it so the audit trail can say who tried.
    req.verifiedClaims = payload;

    // allowed_actions must be a real array of strings: a string would pass includes() by substring.
    const actions = payload.allowed_actions;
    if (!Array.isArray(actions) || !actions.includes(action)) {
      return res.status(403).json({ error: "insufficient_scope" });
    }
    req.tokenClaims = payload;
    next();
  };
}
