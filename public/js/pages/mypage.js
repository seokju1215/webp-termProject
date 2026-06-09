import { apiGet, apiPut } from '../api.js';
import { requireAuth, logout } from '../auth.js';
import { showToast } from '../components/toast.js';
import { initTheme, setupThemeToggle, refreshIcons, escHtml, avatarInitials } from '../main.js';
import { initSidebar } from '../sidebar.js';

requireAuth();
initTheme();
setupThemeToggle();

document.getElementById('sidebar-logout-btn')?.addEventListener('click', logout);
document.getElementById('save-profile-btn').addEventListener('click', saveProfile);

initSidebar();
loadProfile();
loadBookmarks();
loadTeams();
loadActivity();
refreshIcons();

async function loadProfile() {
  try {
    const res = await apiGet('/api/auth/me');
    const user = res.data || res;

    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-email').textContent = user.email;
    document.getElementById('profile-avatar').textContent = avatarInitials(user.name);
    document.getElementById('edit-name').value = user.name;

    const sidebarEl = document.getElementById('sidebar-user-name');
    if (sidebarEl) sidebarEl.textContent = user.name;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveProfile() {
  const name = document.getElementById('edit-name').value.trim();
  const nameErr = document.getElementById('edit-name-err');
  nameErr.classList.add('hidden');

  if (!name) {
    nameErr.textContent = '이름을 입력해주세요.';
    nameErr.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('save-profile-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span> 저장 중...';

  try {
    const res = await apiPut('/api/auth/me', { name });
    const user = res.data || res;

    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-avatar').textContent = avatarInitials(user.name);

    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    stored.name = user.name;
    localStorage.setItem('user', JSON.stringify(stored));

    showToast('프로필이 업데이트되었습니다.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="save" style="width:15px;height:15px;"></i> 저장';
    refreshIcons();
  }
}

async function loadBookmarks() {
  try {
    const teamsRes = await apiGet('/api/teams');
    const teams = Array.isArray(teamsRes) ? teamsRes : (teamsRes.data || []);

    const bookmarked = [];
    await Promise.all(teams.map(async t => {
      try {
        const projRes = await apiGet(`/api/teams/${t.id}/projects?limit=50`);
        const projects = projRes.data || projRes;
        projects.filter(p => p.bookmarked).forEach(p => {
          bookmarked.push({ ...p, teamId: t.id, teamName: t.name });
        });
      } catch {}
    }));

    renderBookmarks(bookmarked);
  } catch {}
}

function renderBookmarks(projects) {
  const list = document.getElementById('bookmark-list');
  const empty = document.getElementById('bookmark-empty');

  if (!projects.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = projects.map(p => `
    <a href="/pages/project-detail.html?teamId=${p.teamId}&projectId=${p.id}" class="bookmark-item">
      ${p.image_url
        ? `<img src="${escHtml(p.image_url)}"
               style="width:40px;height:30px;object-fit:cover;border-radius:var(--radius-sm);flex-shrink:0;" />`
        : `<div style="width:40px;height:30px;background:var(--color-primary-light);border-radius:var(--radius-sm);
                       display:flex;align-items:center;justify-content:center;flex-shrink:0;">
             <i data-lucide="layout-dashboard" style="width:16px;height:16px;color:var(--color-primary);"></i>
           </div>`
      }
      <div style="flex:1;min-width:0;">
        <div style="font-weight:500;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${escHtml(p.name)}
        </div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);">${escHtml(p.teamName || '')}</div>
      </div>
      <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--color-text-muted);flex-shrink:0;"></i>
    </a>
  `).join('');

  refreshIcons();
}

async function loadTeams() {
  try {
    const res = await apiGet('/api/teams');
    const teams = Array.isArray(res) ? res : (res.data || []);
    renderTeams(teams);
  } catch {}
}

function renderTeams(teams) {
  const list = document.getElementById('teams-list');
  const empty = document.getElementById('teams-empty');

  if (!teams.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = teams.map(t => `
    <div class="team-item">
      <div class="avatar avatar-sm">${escHtml(avatarInitials(t.name))}</div>
      <div style="flex:1;">
        <div style="font-weight:500;font-size:0.875rem;">${escHtml(t.name)}</div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);">
          멤버 ${t.member_count || 0}명 · 프로젝트 ${t.project_count || 0}개
        </div>
      </div>
      <a href="/pages/projects.html?teamId=${t.id}" class="btn btn-ghost btn-sm">이동</a>
    </div>
  `).join('');

  refreshIcons();
}

async function loadActivity() {
  try {
    const res = await apiGet('/api/auth/activity');
    const { testcases = [], comments = [] } = res.data || res;
    renderActivity(testcases, comments);
  } catch {}
}

function renderActivity(testcases, comments) {
  const list = document.getElementById('activity-list');
  const empty = document.getElementById('activity-empty');

  if (!testcases.length && !comments.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  const tcItems = testcases.map(tc => `
    <a href="/pages/project-detail.html?teamId=${tc.team_id}&projectId=${tc.project_id}" class="activity-item">
      <i data-lucide="check-square" style="width:14px;height:14px;color:var(--color-primary);flex-shrink:0;"></i>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.875rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(tc.title)}</div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);">${escHtml(tc.project_name)} · 테스트케이스</div>
      </div>
      <span class="badge ${tc.status === 'DONE' ? 'badge-done' : tc.status === 'FAILED' ? 'badge-failed' : 'badge-progress'}" style="flex-shrink:0;">
        ${tc.status === 'DONE' ? '완료' : tc.status === 'FAILED' ? '실패' : '진행'}
      </span>
    </a>
  `);

  const cmtItems = comments.map(c => `
    <a href="/pages/project-detail.html?teamId=${c.team_id}&projectId=${c.project_id}" class="activity-item">
      <i data-lucide="message-square" style="width:14px;height:14px;color:var(--color-warning);flex-shrink:0;"></i>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.content)}</div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);">${escHtml(c.project_name)} · 피드백</div>
      </div>
    </a>
  `);

  list.innerHTML = [...tcItems, ...cmtItems].join('');
  refreshIcons();
}
