const mongoose = require("mongoose");

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const Outlet = require("../models/Outlet");
const OutletItem = require("../models/OutletItem");
const ItemLimit = require("../models/ItemLimit");
const ItemRequest = require("../models/ItemRequest");

const { getMonth } = require("../utils/date");
router.post("/admin/outlets", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const exists = await Outlet.findOne({ email });
  if (exists) {
    return res.status(400).json({ message: "Outlet already exists" });
  }

  const hashed = await bcrypt.hash(password, 10);

  await Outlet.create({
    name,
    email,
    password: hashed
  });

  res.json({ message: "Outlet created successfully" });
});
router.post("/admin/outlets/:outletId/items", async (req, res) => {
  const { outletId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Item name required" });
  }

  await OutletItem.create({
    outletId,
    name
  });

  res.json({ message: "Item added to outlet" });
});
router.post("/admin/item-limits", async (req, res) => {
  try {
    const {
      outletId,
      itemId,
      month,
      monthlyLimit,
      dailyLimit
    } = req.body;

    // 🛑 ABSOLUTE GUARDS (NO DB CALL BEFORE THIS)
    if (
      outletId === undefined ||
      itemId === undefined ||
      month === undefined
    ) {
      return res.status(400).json({
        message: "Missing outletId, itemId or month"
      });
    }

    if (
      outletId === "" ||
      itemId === "" ||
      month === ""
    ) {
      return res.status(400).json({
        message: "Outlet, item and month must be selected"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(outletId)) {
      return res.status(400).json({
        message: "Invalid outletId"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        message: "Invalid itemId"
      });
    }

    if (monthlyLimit === "" || dailyLimit === "") {
      return res.status(400).json({
        message: "Limits are required"
      });
    }

    // ✅ SAFE DB OPERATION
    await ItemLimit.findOneAndUpdate(
      { outletId, itemId, month },
      {
        monthlyLimit: Number(monthlyLimit),
        dailyLimit: Number(dailyLimit)
      },
      { upsert: true, new: true }
    );

    res.json({ message: "Limits saved successfully" });

  } catch (err) {
    console.error("ADMIN ITEM LIMIT ERROR:", err);
    res.status(500).json({
      message: "Internal server error while saving limits"
    });
  }
});
router.get("/admin/reports", async (req, res) => {
  const month = req.query.month || getMonth();

  const report = await ItemRequest.aggregate([
    {
      $match: {
        month,
        status: "served"
      }
    },
    {
      $group: {
        _id: {
          outletId: "$outletId",
          itemId: "$itemId"
        },
        servedCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "outlets",
        localField: "_id.outletId",
        foreignField: "_id",
        as: "outlet"
      }
    },
    { $unwind: "$outlet" },
    {
      $lookup: {
        from: "outletitems",
        localField: "_id.itemId",
        foreignField: "_id",
        as: "item"
      }
    },
    { $unwind: "$item" },
    {
      $project: {
        outletName: "$outlet.name",
        itemName: "$item.name",
        servedCount: 1
      }
    },
    {
      $sort: {
        outletName: 1,
        itemName: 1
      }
    }
  ]);

  res.json(report);
});
module.exports = router;