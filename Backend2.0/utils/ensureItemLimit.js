const ItemLimit = require("../models/ItemLimit");
const { getPreviousMonth } = require("./date");

module.exports = async function ensureItemLimit(outletId, itemId, month) {
  let limit = await ItemLimit.findOne({ outletId, itemId, month });
  if (limit) return limit;

  const prevMonth = getPreviousMonth(month);
  const prevLimit = await ItemLimit.findOne({
    outletId,
    itemId,
    month: prevMonth
  });

  if (!prevLimit) {
    throw new Error("Limits not configured by admin");
  }

  limit = await ItemLimit.create({
    outletId,
    itemId,
    month,
    monthlyLimit: prevLimit.monthlyLimit,
    dailyLimit: prevLimit.dailyLimit
  });

  return limit;
};
