let overlay;

function getOverlay() {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'hidden';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
  return overlay;
}

export function openModal({ title, body, footer, size = 'default' }) {
  const el = getOverlay();
  el.innerHTML = `
    <div class="modal${size === 'lg' ? ' modal-lg' : ''}">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" id="modal-close-btn" aria-label="닫기">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;
  el.classList.remove('hidden');
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.addEventListener('keydown', onEsc);
}

export function closeModal() {
  const el = getOverlay();
  el.classList.add('hidden');
  el.innerHTML = '';
  document.removeEventListener('keydown', onEsc);
}

function onEsc(e) {
  if (e.key === 'Escape') closeModal();
}
