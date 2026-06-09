import { apiGet, apiPost, apiUpload } from '../api.js';
import { requireAuth, logout } from '../auth.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { withSpinner } from '../components/spinner.js';
import { initTheme, setupThemeToggle, refreshIcons, escHtml } from '../main.js';
import { initSidebar } from '../sidebar.js';

requireAuth();
initTheme();
setupThemeToggle();

const urlParams = new URLSearchParams(location.search);
const teamId = urlParams.get('teamId');
if (!teamId) { window.location.href = '/pages/dashboard.html'; throw new Error('no teamId'); }

document.getElementById('sidebar-logout-btn')?.addEventListener('click', logout);

let currentPage = 1;
let currentSort = 'created_at';
let currentOrder = 'desc';
let searchTimeout = null;

apiGet(`/api/teams/${teamId}`).then(res => {
  const name = (res.data || res).name || '프로젝트';
  document.getElementById('page-title').textContent = name;
  document.title = `QAFlow — ${name}`;
}).catch(() => {});

document.getElementById('create-project-btn').addEventListener('click', openCreateProjectModal);
document.getElementById('search-input').addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { currentPage = 1; loadProjects(); }, 300);
});
document.getElementById('sort-select').addEventListener('change', (e) => {
  const [sort, order] = e.target.value.split(':');
  currentSort = sort; currentOrder = order; currentPage = 1;
  loadProjects();
});

initSidebar();
loadProjects();
refreshIcons();

async function loadProjects() {
  const q = document.getElementById('search-input').value.trim();
  const qs = new URLSearchParams({ sort: currentSort, order: currentOrder, page: currentPage, limit: 12 });
  if (q) qs.set('q', q);

  try {
    const res = await withSpinner(() => apiGet(`/api/teams/${teamId}/projects?${qs}`));
    renderProjects(res.data || res, res.meta || {});
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderProjects(projects, meta) {
  const grid = document.getElementById('projects-grid');
  const empty = document.getElementById('empty-projects');
  const pag = document.getElementById('pagination');

  if (!projects.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    pag.innerHTML = '';
    refreshIcons();
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = projects.map(p => `
    <div class="project-card" data-id="${p.id}" role="button" tabindex="0">
      ${p.image_url
        ? `<img class="project-card-thumb" src="${escHtml(p.image_url)}" alt="${escHtml(p.name)}" loading="lazy" />`
        : `<div class="project-card-thumb-placeholder">
             <i data-lucide="layout-dashboard" style="width:36px;height:36px;"></i>
           </div>`
      }
      <div class="project-card-body">
        <div class="project-card-name">${escHtml(p.name)}</div>
        <div class="project-card-url">${escHtml(p.url)}</div>
        <div class="project-card-footer">
          <span title="테스트케이스">
            <i data-lucide="check-square" style="width:12px;height:12px;vertical-align:middle;"></i>
            ${p.testcase_count || 0}
          </span>
          <span title="피드백">
            <i data-lucide="message-square" style="width:12px;height:12px;vertical-align:middle;"></i>
            ${p.comment_count || 0}
          </span>
          <button class="project-card-bookmark${p.bookmarked ? ' active' : ''}"
                  data-id="${p.id}" title="북마크">
            <i data-lucide="bookmark" style="width:16px;height:16px;"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.project-card[data-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.project-card-bookmark')) return;
      window.location.href = `/pages/project-detail.html?teamId=${teamId}&projectId=${card.dataset.id}`;
    });
  });

  grid.querySelectorAll('.project-card-bookmark').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBookmark(btn.dataset.id, btn);
    });
  });

  if (meta.pages > 1) {
    pag.innerHTML = Array.from({ length: meta.pages }, (_, i) => i + 1).map(p =>
      `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`
    ).join('');
    pag.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => { currentPage = +btn.dataset.page; loadProjects(); });
    });
  } else {
    pag.innerHTML = '';
  }

  refreshIcons();
}

async function toggleBookmark(projectId, btn) {
  try {
    const res = await apiPost(`/api/teams/${teamId}/projects/${projectId}/bookmark`, {});
    const bm = (res.data || res).bookmarked;
    btn.classList.toggle('active', bm);
    showToast(bm ? '북마크 추가' : '북마크 해제', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openCreateProjectModal() {
  openModal({
    title: '프로젝트 추가',
    body: `
      <div class="form-group">
        <label class="form-label">프로젝트 이름</label>
        <input class="form-input" id="proj-name-input" placeholder="예: 메인 웹사이트" />
        <span class="form-error hidden" id="proj-name-err"></span>
      </div>
      <div class="form-group">
        <label class="form-label">URL</label>
        <input class="form-input" id="proj-url-input" type="url" placeholder="https://example.com" />
        <span class="form-error hidden" id="proj-url-err"></span>
      </div>
      <div class="form-group">
        <label class="form-label">대표 이미지 <span class="text-muted">(선택, 최대 5MB)</span></label>
        <input type="file" class="form-input" id="proj-image-input" accept="image/*" />
        <div id="proj-image-preview" style="margin-top:0.5rem;display:none;">
          <img id="proj-image-preview-img"
               style="width:100%;max-height:160px;object-fit:cover;border-radius:var(--radius);" />
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-ghost" id="modal-cancel-btn">취소</button>
      <button class="btn btn-primary" id="modal-submit-btn">추가</button>
    `
  });

  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-submit-btn').addEventListener('click', submitCreateProject);
  document.getElementById('proj-image-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('proj-image-preview').style.display = 'block';
      document.getElementById('proj-image-preview-img').src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  setTimeout(() => document.getElementById('proj-name-input')?.focus(), 50);
}

async function submitCreateProject() {
  const name = document.getElementById('proj-name-input').value.trim();
  const url = document.getElementById('proj-url-input').value.trim();
  const imageFile = document.getElementById('proj-image-input').files[0];
  const nameErr = document.getElementById('proj-name-err');
  const urlErr = document.getElementById('proj-url-err');

  nameErr.classList.add('hidden');
  urlErr.classList.add('hidden');

  let valid = true;
  if (!name) { nameErr.textContent = '이름을 입력해주세요.'; nameErr.classList.remove('hidden'); valid = false; }
  if (!url) { urlErr.textContent = 'URL을 입력해주세요.'; urlErr.classList.remove('hidden'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('modal-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span>';

  try {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('url', url);
    if (imageFile) fd.append('image', imageFile);
    await apiUpload(`/api/teams/${teamId}/projects`, fd);
    closeModal();
    showToast('프로젝트가 추가되었습니다!', 'success');
    currentPage = 1;
    loadProjects();
  } catch (err) {
    nameErr.textContent = err.message;
    nameErr.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '추가';
  }
}
