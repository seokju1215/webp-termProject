import { apiGet, apiPost, apiPatch, apiDelete } from '../api.js';
import { requireAuth, logout } from '../auth.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { initTheme, setupThemeToggle, refreshIcons, escHtml, avatarInitials } from '../main.js';

requireAuth();
initTheme();
setupThemeToggle();

const urlParams = new URLSearchParams(location.search);
const teamId = urlParams.get('teamId');
const projectId = urlParams.get('projectId');
if (!teamId || !projectId) { window.location.href = '/pages/dashboard.html'; throw new Error('missing params'); }

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('back-link').href = `/pages/projects.html?teamId=${teamId}`;
document.getElementById('qa-link').href = `/pages/qa.html?teamId=${teamId}&projectId=${projectId}`;

let teamMembers = [];
let bookmarked = false;

document.getElementById('kanban-assignee-filter').addEventListener('change', loadKanban);
document.getElementById('bookmark-btn').addEventListener('click', toggleBookmark);

document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
});

loadProject();
loadKanban();
loadTeamMembers();
refreshIcons();

// 5초마다 칸반 자동 갱신 (드롭다운/모달 열려있으면 스킵)
setInterval(() => {
  if (!document.querySelector('.dropdown-menu.open') && !document.querySelector('.modal-overlay')) {
    loadKanban();
  }
}, 5000);

// ── Project ─────────────────────────────────────────

async function loadProject() {
  try {
    const [projRes, teamRes] = await Promise.all([
      apiGet(`/api/teams/${teamId}/projects/${projectId}`),
      apiGet(`/api/teams/${teamId}`)
    ]);
    const project = projRes.data || projRes;
    const team = teamRes.data || teamRes;

    document.getElementById('project-name').textContent = project.name;
    document.getElementById('breadcrumb-project').textContent = project.name;
    document.getElementById('breadcrumb-team').textContent = team.name || '';
    document.title = `QAFlow — ${project.name}`;

    const urlEl = document.getElementById('project-url');
    urlEl.textContent = project.url;
    urlEl.href = project.url;

    if (project.image_url) {
      document.getElementById('project-image-thumb').style.display = '';
      document.getElementById('project-thumb-img').src = project.image_url;
    }

    bookmarked = project.bookmarked;
    updateBookmarkBtn();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleBookmark() {
  try {
    const res = await apiPost(`/api/teams/${teamId}/projects/${projectId}/bookmark`, {});
    bookmarked = (res.data || res).bookmarked;
    updateBookmarkBtn();
    showToast(bookmarked ? '북마크 추가' : '북마크 해제', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

function updateBookmarkBtn() {
  const btn = document.getElementById('bookmark-btn');
  const fill = bookmarked ? 'fill:var(--color-warning);color:var(--color-warning);' : '';
  btn.innerHTML = `<i data-lucide="bookmark" style="width:16px;height:16px;${fill}"></i>`;
  refreshIcons();
}

// ── Team members ─────────────────────────────────────

async function loadTeamMembers() {
  try {
    const res = await apiGet(`/api/teams/${teamId}/members`);
    teamMembers = res.data || res;
    const filter = document.getElementById('kanban-assignee-filter');
    teamMembers.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      filter.appendChild(opt);
    });
  } catch {}
}

// ── Kanban ───────────────────────────────────────────

async function loadKanban() {
  const assigneeId = document.getElementById('kanban-assignee-filter').value;
  const qs = new URLSearchParams({ limit: 100 });
  if (assigneeId) qs.set('assignee', assigneeId);

  try {
    const res = await apiGet(`/api/projects/${projectId}/comments?${qs}`);
    renderKanban(res.data || res);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderKanban(comments) {
  const cols = { IN_PROGRESS: [], DONE: [], FAILED: [] };
  comments.forEach(c => { if (c.status in cols) cols[c.status].push(c); });

  Object.entries(cols).forEach(([status, items]) => {
    const countEl = document.getElementById(`count-${status}`);
    if (countEl) countEl.textContent = items.length;

    const colEl = document.getElementById(`col-${status}`);
    if (!colEl) return;

    if (!items.length) {
      colEl.innerHTML = `<div style="padding:1.25rem;text-align:center;font-size:0.8125rem;color:var(--color-text-muted);">없음</div>`;
      return;
    }

    colEl.innerHTML = items.map(c => `
      <div class="kanban-card">
        ${c.page_url ? `<a class="kanban-card-url" href="${escHtml(c.page_url)}" target="_blank" rel="noopener" title="${escHtml(c.page_url)}">${escHtml(c.page_url)}</a>` : ''}
        ${c.selector ? `<div class="kanban-card-selector">${escHtml(c.selector)}</div>` : ''}
        <div class="kanban-card-content">${escHtml(c.content)}</div>
        <div class="kanban-card-meta">
          ${c.created_by_name
            ? `<span class="user-chip">
                 <div class="avatar avatar-sm">${escHtml(avatarInitials(c.created_by_name))}</div>
                 ${escHtml(c.created_by_name)}
               </span>`
            : `<span style="font-size:0.75rem;color:var(--color-text-muted);">Agentation</span>`
          }
          ${c.assignee_name
            ? `<span class="badge" style="background:var(--color-primary-light);color:var(--color-primary);font-size:0.7rem;">
                 ${escHtml(c.assignee_name)}
               </span>`
            : ''
          }
          <div class="dropdown" style="margin-left:auto;">
            <button class="btn btn-ghost btn-sm kc-more" style="padding:0.2rem 0.3rem;">
              <i data-lucide="more-horizontal" style="width:13px;height:13px;"></i>
            </button>
            <div class="dropdown-menu">
              <div style="padding:0.2rem 0.75rem;font-size:0.7rem;color:var(--color-text-muted);font-weight:600;">칸반 이동</div>
              <button class="dropdown-item" data-cid="${c.id}" data-status="IN_PROGRESS">
                <i data-lucide="alert-circle" style="width:13px;height:13px;"></i> 수정 필요
              </button>
              <button class="dropdown-item" data-cid="${c.id}" data-status="DONE">
                <i data-lucide="check-circle" style="width:13px;height:13px;"></i> 수정 완료
              </button>
              <button class="dropdown-item" data-cid="${c.id}" data-status="FAILED">
                <i data-lucide="x-circle" style="width:13px;height:13px;"></i> 반려
              </button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item" data-cid="${c.id}" data-action="assign">
                <i data-lucide="user-check" style="width:13px;height:13px;"></i> 담당자 지정
              </button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item danger" data-cid="${c.id}" data-action="delete">
                <i data-lucide="trash-2" style="width:13px;height:13px;"></i> 삭제
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    colEl.querySelectorAll('.kc-more').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = btn.nextElementSibling;
        const wasOpen = menu.classList.contains('open');
        document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
        if (!wasOpen) {
          const rect = btn.getBoundingClientRect();
          menu.style.position = 'fixed';
          menu.style.zIndex = '9999';
          menu.style.left = 'auto';
          menu.style.right = `${window.innerWidth - rect.right}px`;
          const estimatedHeight = 230;
          if (rect.bottom + estimatedHeight > window.innerHeight) {
            menu.style.top = 'auto';
            menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
          } else {
            menu.style.top = `${rect.bottom + 4}px`;
            menu.style.bottom = 'auto';
          }
          menu.classList.add('open');
        }
      });
    });

    colEl.querySelectorAll('.dropdown-item[data-cid]').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        item.closest('.dropdown-menu').classList.remove('open');
        const { cid, status, action } = item.dataset;

        if (status) {
          try {
            await apiPatch(`/api/projects/${projectId}/comments/${cid}/status`, { status });
            showToast('상태 변경 완료', 'success');
            loadKanban();
          } catch (err) { showToast(err.message, 'error'); }
        } else if (action === 'assign') {
          openAssignModal(cid);
        } else if (action === 'delete') {
          if (!confirm('정말 삭제하시겠습니까?')) return;
          try {
            await apiDelete(`/api/projects/${projectId}/comments/${cid}`);
            showToast('삭제되었습니다', 'success');
            loadKanban();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });
  });

  refreshIcons();
}

function openAssignModal(commentId) {
  const options = teamMembers.map(m =>
    `<option value="${m.id}">${escHtml(m.name)}</option>`
  ).join('');

  openModal({
    title: '담당자 지정',
    body: `
      <div class="form-group">
        <label class="form-label">담당자</label>
        <select class="form-input" id="assignee-select">
          <option value="">담당자 없음 (해제)</option>
          ${options}
        </select>
      </div>
    `,
    footer: `
      <button class="btn btn-ghost" id="modal-cancel-btn">취소</button>
      <button class="btn btn-primary" id="modal-submit-btn">지정</button>
    `
  });

  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-submit-btn').addEventListener('click', async () => {
    const assigneeId = document.getElementById('assignee-select').value || null;
    const btn = document.getElementById('modal-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span>';
    try {
      await apiPatch(`/api/projects/${projectId}/comments/${commentId}/assignee`, { assigneeId });
      closeModal();
      showToast('담당자 지정 완료', 'success');
      loadKanban();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = '지정';
    }
  });
}
