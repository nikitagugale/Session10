// The deck's helper from slide 101, exactly as printed (plus the import path). Used only by the milestone 6 check, which swaps it
// in for your middleware on a scratch copy to see whether YOUR tests notice. It is meant to be unsafe in two ways.
import jwt from "jsonwebtoken";
export function requireScope(action) {
  return (req, res, next) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_PUBLIC_KEY, {
        audience: "agent-tools",
        issuer: "https://auth.internal.bank/",
      });
    } catch (e) {
      return res.status(401).json({ error: "invalid_token" });
    }
    if (!payload.allowed_actions?.includes(action)) {
      return res.status(403).json({ error: "insufficient_scope" });
    }
    req.tokenClaims = payload;
    next();
  };
}
