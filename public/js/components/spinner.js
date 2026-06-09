let spinnerEl;
let count = 0;

function getSpinner() {
  if (!spinnerEl) {
    spinnerEl = document.createElement('div');
    spinnerEl.id = 'spinner-overlay';
    spinnerEl.className = 'hidden';
    spinnerEl.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(spinnerEl);
  }
  return spinnerEl;
}

export function showSpinner() {
  count++;
  getSpinner().classList.remove('hidden');
}

export function hideSpinner() {
  count = Math.max(0, count - 1);
  if (count === 0) getSpinner().classList.add('hidden');
}

// 비동기 작업을 래핑해서 자동으로 스피너 표시/숨김
export async function withSpinner(fn) {
  showSpinner();
  try {
    return await fn();
  } finally {
    hideSpinner();
  }
}
