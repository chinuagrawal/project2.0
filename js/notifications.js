// Notification Logic
const bellBtn = document.getElementById("bellBtn");
const notifDropdown = document.getElementById("notifDropdown");
const notifList = document.getElementById("notifList");
const notifBadge = document.getElementById("notifBadge");

// Request Notification Permission
if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}

if (bellBtn) {
  bellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notifDropdown.style.display =
      notifDropdown.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", () => {
    if (notifDropdown) notifDropdown.style.display = "none";
  });

  async function loadNotifications() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || !user.email) return;

    try {
      const res = await fetch(
        `https://kanhabackend.onrender.com/api/users/bookings?email=${user.email}`,
      );
      if (!res.ok) return;

      const bookings = await res.json();
      if (bookings.length === 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Find the latest (expiry) date among all bookings
      const expiryDateStr = bookings.reduce((max, b) => {
        return b.date > max ? b.date : max;
      }, bookings[0].date);

      const expiryDate = new Date(expiryDateStr);
      expiryDate.setHours(0, 0, 0, 0);

      const diffTime = expiryDate - today;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const notifications = [];

      // 2. Only notify if the REAL expiry is in the next 2 days (as requested)
      if (diffDays >= 0 && diffDays <= 2) {
        const msg =
          diffDays === 0
            ? `Your library seat booking expires TODAY!`
            : `Your library seat booking expires in ${diffDays} day${diffDays > 1 ? "s" : ""}. Please renew.`;

        notifications.push({
          msg: msg,
          urgent: diffDays <= 1,
        });

        // Trigger System Notification
        if (Notification.permission === "granted") {
          const notificationTitle = "Kanha Library Expiry Alert";
          const notificationOptions = {
            body: msg,
            icon: "/images/logo.jpg",
            badge: "/images/icon-512.png",
            vibrate: [200, 100, 200],
            tag: "expiry-alert", // Tag prevents duplicate notifications
            renotify: true,
          };

          if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification(
                notificationTitle,
                notificationOptions,
              );
            });
          } else {
            new Notification(notificationTitle, notificationOptions);
          }
        }
      }

      if (notifications.length > 0) {
        notifList.innerHTML = notifications
          .map(
            (n) => `
                        <div style="padding: 10px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: ${n.urgent ? "#e53935" : "#333"}; background: ${n.urgent ? "#fff0f0" : "transparent"}; border-radius: 4px; margin-bottom: 4px;">
                            ${n.msg}
                        </div>
                    `,
          )
          .join("");
        notifBadge.style.display = "block";
      }
    } catch (err) {
      console.error("Error loading notifications", err);
    }
  }

  loadNotifications();
}
