const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const ItemRequest = require("../models/ItemRequest");
const { getMonth } = require("../utils/date");

/* =====================================================
   GET PENDING REQUESTS
   ===================================================== */
router.get("/outlet/requests/pending", async (req, res) => {
  try {
    const { outletId } = req.query;

    if (!outletId) {
      return res.status(400).json({ message: "outletId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(outletId)) {
      return res.status(400).json({ message: "Invalid outletId" });
    }

    const requests = await ItemRequest.find({
      outletId: new mongoose.Types.ObjectId(outletId),
      status: "pending"
    })
      .populate("itemId", "name")
      .sort({ createdAt: 1 });

    res.json(
      requests.map(r => ({
        requestId: r._id,
        studentMobile: r.mobile,
        itemName: r.itemId?.name || "Item",
        requestedAt: r.createdAt
      }))
    );

  } catch (err) {
    console.error("OUTLET PENDING ERROR:", err);
    res.status(500).json({ message: "Failed to load pending requests" });
  }
});

/* =====================================================
   SERVE REQUEST
   ===================================================== */
router.post("/outlet/requests/:requestId/serve", async (req, res) => {
  try {
    const { outletId } = req.query;
    const { requestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(outletId)) {
      return res.status(400).json({ message: "Invalid outletId" });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid requestId" });
    }

    const request = await ItemRequest.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      outletId: new mongoose.Types.ObjectId(outletId),
      status: "pending"
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    request.status = "served";
    request.servedAt = new Date();
    await request.save();

    res.json({ message: "Item marked as served" });

  } catch (err) {
    console.error("SERVE ERROR:", err);
    res.status(500).json({ message: "Failed to serve request" });
  }
});

/* =====================================================
   REJECT REQUEST
   ===================================================== */
router.post("/outlet/requests/:requestId/reject", async (req, res) => {
  try {
    const { outletId } = req.query;
    const { requestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(outletId)) {
      return res.status(400).json({ message: "Invalid outletId" });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid requestId" });
    }

    const request = await ItemRequest.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      outletId: new mongoose.Types.ObjectId(outletId),
      status: "pending"
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    request.status = "rejected";
    await request.save();

    res.json({ message: "Request rejected" });

  } catch (err) {
    console.error("REJECT ERROR:", err);
    res.status(500).json({ message: "Failed to reject request" });
  }
});

/* =====================================================
   MONTHLY SUMMARY
   ===================================================== */
router.get("/outlet/summary", async (req, res) => {
  try {
    const { outletId, month } = req.query;

    if (!mongoose.Types.ObjectId.isValid(outletId)) {
      return res.status(400).json({ message: "Invalid outletId" });
    }

    const data = await ItemRequest.aggregate([
      {
        $match: {
          outletId: new mongoose.Types.ObjectId(outletId),
          month: month || getMonth(),
          status: "served"
        }
      },
      {
        $group: {
          _id: "$itemId",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(data);

  } catch (err) {
    console.error("SUMMARY ERROR:", err);
    res.status(500).json({ message: "Failed to load summary" });
  }
});

module.exports = router;
