document.addEventListener("DOMContentLoaded", function() {
      const slider = document.querySelector(".testimonial-slider");
      const testimonials = Array.from(document.querySelectorAll(".testimonial-card"));
      const screenWidth = window.innerWidth;

      // --- Logic for DESKTOP (Infinite Scroll) ---
      if (screenWidth >= 768) {
        // Clone all testimonials and append them to the slider
        // so the CSS animation can scroll through a repeating set.
        testimonials.forEach(card => {
          const clone = card.cloneNode(true);
          slider.appendChild(clone);
        });
      }
      // --- Logic for MOBILE (Auto-Swap) ---
      else {
        let currentIndex = 0;
        const totalTestimonials = testimonials.length;

        // Ensure the slider uses transitions on mobile (CSS animation disabled there)
        slider.style.transition = 'transform 0.5s ease-in-out';

        function showNextTestimonial() {
          currentIndex = (currentIndex + 1) % totalTestimonials;
          const offset = -currentIndex * 100; // move by 100% increments (cards are 100% width)
          slider.style.transform = `translateX(${offset}%)`;
        }

        // Automatically swap testimonials every 5 seconds (5000ms)
        setInterval(showNextTestimonial, 3000);
      }
    });

    // Optional: if the user resizes window make a simple reload to re-evaluate layout.
    // (Helps when rotating phone; remove if you don't want reloads)
    window.addEventListener('resize', () => {
      // small debounce
      clearTimeout(window._resizeTO);
      window._resizeTO = setTimeout(() => location.reload(), 300);
    });