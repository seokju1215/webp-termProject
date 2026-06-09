import { apiGet, apiPost } from '../api.js';
import { requireAuth, getUser, logout } from '../auth.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { withSpinner } from '../components/spinner.js';
import { initTheme, setupThemeToggle, refreshIcons, escHtml } from '../main.js';
import { initSidebar } from '../sidebar.js';

requireAuth();
initTheme();
setupThemeToggle();

const user = getUser();
const sidebarUserEl = document.getElementById('sidebar-user-name');
if (sidebarUserEl && user) sidebarUserEl.textContent = user.name;

document.getElementById('sidebar-logout-btn')?.addEventListener('click', logout);

['create-team-btn', 'create-team-sidebar-btn', 'create-team-empty-btn'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', openCreateTeamModal);
});

initSidebar();
loadTeams();
refreshIcons();

async function loadTeams() {
  try {
    const res = await withSpinner(() => apiGet('/api/teams'));
    const teams = Array.isArray(res) ? res : (res.data || []);
    renderTeams(teams);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTeams(teams) {
  const grid = document.getElementById('teams-grid');
  const empty = document.getElementById('empty-teams');

  if (!teams.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    refreshIcons();
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = teams.map(t => `
    <div class="project-card" data-id="${t.id}" role="button" tabindex="0">
      <div class="project-card-thumb-placeholder">
        <i data-lucide="users" style="width:40px;height:40px;"></i>
      </div>
      <div class="project-card-body">
        <div class="project-card-name">${escHtml(t.name)}</div>
        <div class="project-card-footer">
          <span><i data-lucide="user" style="width:12px;height:12px;vertical-align:middle;"></i> ${t.member_count || 0}명</span>
          <span><i data-lucide="folder" style="width:12px;height:12px;vertical-align:middle;"></i> ${t.project_count || 0}개</span>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.project-card[data-id]').forEach(card => {
    const go = () => { window.location.href = `/pages/projects.html?teamId=${card.dataset.id}`; };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });

  refreshIcons();
}

function openCreateTeamModal() {
  openModal({
    title: '팀 만들기',
    body: `
      <div class="form-group">
        <label class="form-label">팀 이름</label>
        <input class="form-input" id="team-name-input" placeholder="팀 이름을 입력하세요" maxlength="100" />
        <span class="form-error hidden" id="team-name-error"></span>
      </div>
    `,
    footer: `
      <button class="btn btn-ghost" id="modal-cancel-btn">취소</button>
      <button class="btn btn-primary" id="modal-submit-btn">만들기</button>
    `
  });

  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-submit-btn').addEventListener('click', submitCreateTeam);
  document.getElementById('team-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitCreateTeam();
  });
  setTimeout(() => document.getElementById('team-name-input')?.focus(), 50);
}

async function submitCreateTeam() {
  const input = document.getElementById('team-name-input');
  const errEl = document.getElementById('team-name-error');
  const name = input.value.trim();

  if (!name) {
    errEl.textContent = '팀 이름을 입력해주세요.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('modal-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span>';

  try {
    await apiPost('/api/teams', { name });
    closeModal();
    showToast('팀이 생성되었습니다!', 'success');
    loadTeams();
    initSidebar();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '만들기';
  }
}
