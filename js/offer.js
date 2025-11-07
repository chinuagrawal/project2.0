

  (function(){
    const modal = document.getElementById('offers-modal');
    const card = modal.querySelector('.card');
    const closeBtn = document.getElementById('closeOffersBtn');
    const cta = document.getElementById('bookSeatBtn');

    // open once per session
    document.addEventListener('DOMContentLoaded', () => {
      if (!sessionStorage.getItem('offersSeen')) {
        openModal();
        sessionStorage.setItem('offersSeen','1');
      }
    });

    function openModal(){
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden','false');
      // small timeout to allow animations to run then focus the close button
      setTimeout(()=> closeBtn.focus(), 520);
      // trap focus inside modal (simple)
      document.addEventListener('focus', focusTrap, true);
      document.addEventListener('keydown', onKeyDown);
    }

    function closeModal(){
      // animate out: fade backdrop & sink card slightly
      modal.style.opacity = '1';
      card.style.transition = 'transform 260ms ease, opacity 220ms ease';
      card.style.transform = 'translateY(12px) scale(.98)';
      card.style.opacity = '0';
      modal.querySelector('::before');
      modal.style.transition = 'opacity 300ms ease';
      modal.style.opacity = '0';
      setTimeout(() => {
        modal.style.display = 'none';
        modal.style.opacity = '';
        card.style.transform = '';
        card.style.opacity = '';
        modal.setAttribute('aria-hidden','true');
      }, 320);
      document.removeEventListener('focus', focusTrap, true);
      document.removeEventListener('keydown', onKeyDown);
    }

    closeBtn.addEventListener('click', closeModal);
    // clicking outside the card closes modal
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // keyboard: Esc to close, Enter on CTA triggers link (native)
    function onKeyDown(e){
      if (e.key === 'Escape') { closeModal(); }
      // keep Tab cycling inside modal (basic)
      if (e.key === 'Tab') {
        const focusable = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
                            .filter(el => !el.disabled && el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0], last = focusable[focusable.length-1];
        if (!modal.contains(document.activeElement)) { first.focus(); e.preventDefault(); return; }
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    }

    // very small focus trap that keeps focus inside modal
    function focusTrap(e){
      if (!modal.contains(e.target)) {
        e.stopPropagation();
        closeBtn.focus();
      }
    }

    // optional: click CTA gives quick micro-animation
    cta.addEventListener('click', () => {
      cta.animate([{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 240 });
    });
  })();
