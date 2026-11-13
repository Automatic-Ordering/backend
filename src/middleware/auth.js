const jwt = require("jsonwebtoken");
const { Admin, Store, StoreAccount } = require("../../models");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required.");
  }
  return process.env.JWT_SECRET;
};

const authenticate = async (req, res, next) => {
  const authorization = req.get("authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "UNAUTHORIZED", message: "인증 헤더가 필요합니다." });
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return res
      .status(401)
      .json({ error: "UNAUTHORIZED", message: "인증 토큰이 필요합니다." });
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch {
    return res
      .status(401)
      .json({
        error: "UNAUTHORIZED",
        message: "유효하지 않거나 만료된 토큰입니다.",
      });
  }

  try {
    if (payload.role === "ADMIN" && Number.isInteger(payload.adminId)) {
      const admin = await Admin.findByPk(payload.adminId);
      if (admin) {
        req.user = { adminId: payload.adminId, role: "ADMIN" };
        return next();
      }
    }

    if (payload.role === "STORE" && Number.isInteger(payload.storeId)) {
      const store = await Store.findByPk(payload.storeId, {
        include: [{ model: StoreAccount, as: "account", required: true }],
      });
      if (store && store.status === "ACTIVE") {
        req.user = {
          storeId: store.storeId,
          storeCode: store.storeCode,
          storeName: store.storeName,
          status: store.status,
          accountId: store.account.accountId,
          passwordChangeRequired: Boolean(store.account.passwordChangeRequired),
          role: "STORE",
        };
        return next();
      }
    }

    return res
      .status(401)
      .json({
        error: "UNAUTHORIZED",
        message: "인증이 더 이상 유효하지 않습니다.",
      });
  } catch (error) {
    return next(error);
  }
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "FORBIDDEN", message: "권한이 부족합니다." });
    }
    return next();
  };

const rejectPasswordChangeRequired = (req, res, next) => {
  if (req.user?.role === "STORE" && req.user.passwordChangeRequired) {
    return res.status(403).json({
      error: "PASSWORD_CHANGE_REQUIRED",
      message: "이 API를 사용하기 전에 초기 비밀번호를 변경해야 합니다.",
    });
  }
  return next();
};

module.exports = {
  authenticate,
  requireRole,
  rejectPasswordChangeRequired,
  getJwtSecret,
};
