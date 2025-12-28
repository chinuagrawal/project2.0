const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");


const Outlet = require("../models/Outlet");
const OutletItem = require("../models/OutletItem");
const ItemLimit = require("../models/ItemLimit");
const ItemRequest = require("../models/ItemRequest");

const { getToday, getMonth } = require("../utils/date");
const ensureItemLimit = require("../utils/ensureItemLimit");

/**
 * -----------------------------------
 * 1️⃣ GET OUTLETS
 * -----------------------------------
 */
router.get("/outlets", async (req, res) => {
  const outlets = await Outlet.find({ active: true }).select("name");
  res.json(outlets);
});

/**
 * -----------------------------------
 * 2️⃣ GET ITEMS + LIMITS FOR OUTLET
 * -----------------------------------
 */
router.get("/outlets/:outletId/items", async (req, res) => {
  const { outletId } = req.params;
  const month = getMonth();

  const items = await OutletItem.find({
    outletId,
    active: true
  });

  const result = [];

  for (const item of items) {
    let limit = await ItemLimit.findOne({
      outletId,
      itemId: item._id,
      month
    });

    if (!limit) {
      const prevMonth = require("../utils/date").getPreviousMonth(month);
      limit = await ItemLimit.findOne({
        outletId,
        itemId: item._id,
        month: prevMonth
      });
    }

    result.push({
      itemId: item._id,
      name: item.name,
      monthlyLimit: limit?.monthlyLimit ?? 0,
      dailyLimit: limit?.dailyLimit ?? 0
    });
  }

  res.json(result);
});

/**
 * -----------------------------------
 * 3️⃣ REQUEST ITEM (CORE)
 * -----------------------------------
 */
router.post("/requests", async (req, res) => {
  try {
    const { outletId, itemId, mobile } = req.body;


    if (!outletId || !itemId || !mobile) {
      return res.status(400).json({
        message: "outletId, itemId and mobile are required"
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(outletId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      return res.status(400).json({
        message: "Invalid outletId or itemId"
      });
    }

    const today = getToday();
    const month = getMonth();

    // ensure limits (auto-copy from previous month)
    const limit = await ensureItemLimit(outletId, itemId, month);

    // daily served count
    const servedToday = await ItemRequest.countDocuments({
      outletId,
      itemId,
      requestDate: today,
      status: "served"
    });

    if (servedToday >= limit.dailyLimit) {
      return res.status(400).json({
        message: "Daily limit reached for this item"
      });
    }

    // monthly served count
    const servedMonth = await ItemRequest.countDocuments({
      outletId,
      itemId,
      month,
      status: "served"
    });

    if (servedMonth >= limit.monthlyLimit) {
      return res.status(400).json({
        message: "Monthly limit reached for this item"
      });
    }

    // create request
  await ItemRequest.create({
  mobile,
  outletId,
  itemId,
  requestDate: today,
  month,
  status: "pending"
});



    res.json({ message: "Request sent successfully" });

  } catch (err) {
    console.error("REQUEST ERROR:", err);
    res.status(500).json({
      message: "Failed to create request"
    });
  }
});

module.exports = router;
