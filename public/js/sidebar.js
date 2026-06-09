import { apiGet } from './api.js';
import { getUser, logout } from './auth.js';
import { escHtml, refreshIcons } from './main.js';

export async function initSidebar() {
  const urlParams = new URLSearchParams(location.search);
  const activeTeamId = urlParams.get('teamId') || null;

  const user = getUser();
  const nameEl = document.getElementById('sidebar-user-name');
  if (nameEl && user) nameEl.textContent = user.name;

  document.getElementById('sidebar-logout-btn')?.addEventListener('click', logout);

  // Mobile: backdrop + hamburger toggle
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.createElement('div');
  backdrop.id = 'sidebar-backdrop';
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  const navbarInner = document.querySelector('.navbar-inner');
  if (navbarInner && !document.getElementById('mobile-menu-btn')) {
    const menuBtn = document.createElement('button');
    menuBtn.id = 'mobile-menu-btn';
    menuBtn.className = 'btn btn-ghost btn-sm mobile-menu-btn';
    menuBtn.setAttribute('aria-label', '메뉴 열기');
    menuBtn.innerHTML = '<i data-lucide="menu" style="width:18px;height:18px;"></i>';
    navbarInner.prepend(menuBtn);
    menuBtn.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      backdrop.classList.add('active');
      refreshIcons();
    });
  }
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    backdrop.classList.remove('active');
  });

  try {
    const res = await apiGet('/api/teams');
    const teams = Array.isArray(res) ? res : (res.data || []);
    renderSidebarTeams(teams, activeTeamId);
  } catch {}
}

function renderSidebarTeams(teams, activeTeamId) {
  const container = document.getElementById('sidebar-teams');
  if (!container) return;

  if (!teams.length) {
    container.innerHTML = `<span style="padding:0.25rem 0.75rem;font-size:0.8rem;color:var(--color-text-muted);">팀이 없습니다</span>`;
    return;
  }

  container.innerHTML = teams.map(t => `
    <a href="/pages/projects.html?teamId=${t.id}"
       class="sidebar-item${t.id === activeTeamId ? ' active' : ''}">
      <i data-lucide="users" style="width:15px;height:15px;flex-shrink:0;"></i>
      <span>${escHtml(t.name)}</span>
    </a>
  `).join('');

  refreshIcons();
}
