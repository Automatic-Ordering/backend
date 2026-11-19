const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { getDashboardSummary } = require("../services/dashboardService");

const router = express.Router();

router.use(authenticate, requireRole("STORE"));

router.get("/", async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const summary = await getDashboardSummary(storeId);
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "대시보드 요약 데이터를 불러오는 중 오류가 발생했습니다.",
    });
  }
});

module.exports = router;
