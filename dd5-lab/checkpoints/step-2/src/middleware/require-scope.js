// STARTER CODE for Milestone 4. This is the helper from the course deck, exactly as it was printed.
// It is NOT wired into any route yet. Your job is to find out what is wrong with it and fix it.
// Keep the export name and the file path: other code and the checks rely on them (see LAB-GUIDE.md, Milestone 4).
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
