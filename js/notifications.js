
    // Notification Logic
    const bellBtn = document.getElementById('bellBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifList = document.getElementById('notifList');
    const notifBadge = document.getElementById('notifBadge');

    // Request Notification Permission
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    if(bellBtn){
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.style.display = notifDropdown.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', () => {
            if(notifDropdown) notifDropdown.style.display = 'none';
        });

        async function loadNotifications() {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user || !user.email) return;

            try {
                const res = await fetch(`https://kanha-backend-yfx1.onrender.com/api/users/bookings?email=${user.email}`);
                if(!res.ok) return;
                
                const bookings = await res.json();
                
                const today = new Date();
                const notifications = [];

                bookings.forEach(b => {
                    const bookingDate = new Date(b.date);
                    const diffTime = bookingDate - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    
                    if (diffDays >= 0 && diffDays <= 3) {
                        const msg = `Your seat for ${b.date} expires in ${diffDays === 0 ? 'today' : diffDays + ' day(s)'}.`;
                        notifications.push({
                            msg: msg,
                            urgent: diffDays <= 1
                        });

                        // Trigger System Notification
                        if (Notification.permission === "granted") {
                            // Use Service Worker if available for better mobile support
                            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                                navigator.serviceWorker.ready.then(registration => {
                                    registration.showNotification("Kanha Library Alert", {
                                        body: msg,
                                        icon: "/images/logo.jpg", // Ensure this exists or fallback
                                        badge: "/images/icon-512.png",
                                        vibrate: [200, 100, 200]
                                    });
                                });
                            } else {
                                // Fallback to standard Notification API
                                new Notification("Kanha Library Alert", {
                                    body: msg,
                                    icon: "/images/logo.jpg"
                                });
                            }
                        }
                    }
                });

                if (notifications.length > 0) {
                    notifList.innerHTML = notifications.map(n => `
                        <div style="padding: 10px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: ${n.urgent ? '#e53935' : '#333'}; background: ${n.urgent ? '#fff0f0' : 'transparent'}; border-radius: 4px; margin-bottom: 4px;">
                            ${n.msg}
                        </div>
                    `).join('');
                    notifBadge.style.display = 'block';
                }
            } catch (err) {
                console.error("Error loading notifications", err);
            }
        }
        
        loadNotifications();
    }
