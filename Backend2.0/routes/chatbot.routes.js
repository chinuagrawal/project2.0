const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const User = require("../models/User");
const PriceSetting = require("../models/PriceSetting");
const axios = require("axios");

// Helper: Calculate Tomorrow's Date
const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const getToday = () => {
  return new Date().toISOString().split("T")[0];
};

// POST /api/chat
router.post("/", async (req, res) => {
  const { message, mobile } = req.body;

  if (!mobile) {
    return res.json({ reply: "Please provide your mobile number to identify you." });
  }

  // 1. Identify User
  let user = null;
  try {
    user = await User.findOne({ mobile });
    if (!user) {
      return res.json({ reply: "I couldn't find a user with that mobile number. Please register first." });
    }
  } catch (err) {
    return res.status(500).json({ reply: "Database error checking user." });
  }

  const userMessage = message.toLowerCase();

  // 2. AI / Logic Engine
  // If OpenAI Key exists, use it (Skeleton for future)
  if (process.env.OPENAI_API_KEY) {
    try {
        // Implementation of OpenAI call would go here.
        // For now, we fall back to the robust logic below to ensure the specific requirements work perfectly.
    } catch (e) {
        console.error("OpenAI Error:", e);
    }
  }

  // 3. Logic Handling (Robust Regex/Keyword Matching)

  try {
    // --- QUERY: FREE SEATS ---
    if (userMessage.includes("free") || userMessage.includes("available") || userMessage.includes("empty")) {
      const targetDate = userMessage.includes("tomorrow") ? getTomorrow() : getToday();
      
      const totalSeats = 34; // Kanha Library Capacity
      const bookings = await Booking.find({ date: targetDate, status: "paid" });
      
      // Count occupied by shift
      const fullShift = bookings.filter(b => b.shift === "full").length;
      const amShift = bookings.filter(b => b.shift === "am").length;
      const pmShift = bookings.filter(b => b.shift === "pm").length;

      // Logic: Full shift blocks both AM and PM. AM blocks AM. PM blocks PM.
      // But simpler availability:
      // Available AM = Total - (Full + AM)
      // Available PM = Total - (Full + PM)
      // Available Full = Total - (Full + AM + PM) -- approximation, actually complex seat logic.
      
      // Let's give a simple summary
      const occupiedAM = fullShift + amShift;
      const occupiedPM = fullShift + pmShift;
      
      return res.json({ 
        reply: `On ${targetDate}:
        - AM Shift: ${Math.max(0, totalSeats - occupiedAM)} seats free
        - PM Shift: ${Math.max(0, totalSeats - occupiedPM)} seats free`
      });
    }

    // --- QUERY: BOOKING DETAILS ---
    if (userMessage.includes("my booking") || userMessage.includes("details") || userMessage.includes("status")) {
      const myBookings = await Booking.find({ 
        email: user.email, 
        status: "paid",
        date: { $gte: getToday() } 
      }).sort({ date: 1 });

      if (myBookings.length === 0) {
        return res.json({ reply: "You have no active upcoming bookings." });
      }

      const nextBooking = myBookings[0];
      return res.json({ 
        reply: `Your next booking is for Seat ${nextBooking.seatId} (${nextBooking.shift.toUpperCase()}) on ${nextBooking.date}.`
      });
    }

    // --- QUERY: EXPIRY ---
    if (userMessage.includes("expire") || userMessage.includes("end") || userMessage.includes("validity")) {
        const myBookings = await Booking.find({ 
            email: user.email, 
            status: "paid",
            date: { $gte: getToday() } 
          }).sort({ date: -1 }); // Latest last
    
        if (myBookings.length === 0) {
            return res.json({ reply: "You don't have an active subscription." });
        }
        
        const lastBooking = myBookings[0];
        return res.json({ reply: `Your current seat subscription expires on ${lastBooking.date}.` });
    }

    // --- QUERY: EXTENSION ---
    if (userMessage.includes("extend")) {
        return res.json({ 
            reply: "To extend your seat, simply go to the Booking page. If you are logged in, click 'Extend Booking' to keep your current seat." 
        });
    }

    // --- QUERY: PRICE ---
    if (userMessage.includes("price") || userMessage.includes("cost") || userMessage.includes("rate")) {
        const prices = await PriceSetting.findOne();
        if (!prices) return res.json({ reply: "Pricing information is currently unavailable." });
        
        return res.json({ 
            reply: `Monthly Prices:
            - Full Day: ₹${prices.full}
            - AM Shift: ₹${prices.am}
            - PM Shift: ₹${prices.pm}`
        });
    }

    // Default Fallback
    return res.json({ 
        reply: "I'm not sure about that. You can ask me about seat availability, your bookings, expiry dates, or prices!" 
    });

  } catch (err) {
    console.error("Chatbot Error:", err);
    return res.status(500).json({ reply: "Sorry, I encountered an error checking that for you." });
  }
});

module.exports = router;
