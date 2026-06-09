import { apiGet } from '../api.js';
import { requireAuth, logout } from '../auth.js';
import { showToast } from '../components/toast.js';
import { initTheme, setupThemeToggle, refreshIcons, escHtml } from '../main.js';

requireAuth();
initTheme();
setupThemeToggle();

const urlParams = new URLSearchParams(location.search);
const teamId = urlParams.get('teamId');
const projectId = urlParams.get('projectId');
if (!teamId || !projectId) { window.location.href = '/pages/dashboard.html'; throw new Error('missing params'); }

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('back-link').href = `/pages/project-detail.html?teamId=${teamId}&projectId=${projectId}`;
document.getElementById('refresh-btn').addEventListener('click', loadFeedback);
document.getElementById('export-feedback-btn').addEventListener('click', exportFeedbackCSV);

// Tab switching
document.querySelectorAll('.qa-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.qa-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.qa-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// Copy buttons
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const text = btn.dataset.copy
      || btn.previousSibling?.textContent?.trim()
      || btn.closest('.code-block')?.querySelector('span')?.textContent?.trim()
      || '';
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }).catch(() => showToast('클립보드 복사 실패', 'error'));
  });
});

loadProject();
loadFeedback();
refreshIcons();

// 3초마다 새 피드백 체크
let knownIds = new Set();
setInterval(async () => {
  try {
    const res = await apiGet(`/api/projects/${projectId}/comments?limit=50&sort=created_at&order=desc`);
    const comments = res.data || res;
    const newItems = comments.filter(c => !knownIds.has(c.id));
    if (!newItems.length) return;
    comments.forEach(c => knownIds.add(c.id));
    document.getElementById('feedback-count').textContent = comments.length;
    const list = document.getElementById('feedback-list');
    document.getElementById('feedback-empty').classList.add('hidden');
    newItems.forEach(c => {
      const div = document.createElement('div');
      div.className = 'feedback-item feedback-item-new';
      div.innerHTML = buildFeedbackHtml(c);
      list.prepend(div);
      setTimeout(() => div.classList.remove('feedback-item-new'), 700);
    });
    refreshIcons();
  } catch {}
}, 3000);

async function loadProject() {
  try {
    const res = await apiGet(`/api/teams/${teamId}/projects/${projectId}`);
    const project = res.data || res;

    document.getElementById('project-name-nav').textContent = project.name;
    document.getElementById('qa-url-display').textContent = project.url;
    document.getElementById('open-tab-btn').href = project.url;
    document.title = `QAFlow — QA: ${project.name}`;

    // Try iframe load
    const iframe = document.getElementById('qa-iframe');
    iframe.addEventListener('error', () => showIframeBlocked(project.url), { once: true });
    iframe.src = project.url;

    // Setup guide
    const webhookUrl = `${location.origin}/api/webhooks/agentation?projectId=${projectId}`;
    document.getElementById('webhook-url').textContent = webhookUrl;
    document.getElementById('copy-webhook-btn').dataset.copy = webhookUrl;

    const initCode = `import { Agentation } from 'agentation';\n\nAgentation.init({\n  webhookUrl: '${webhookUrl}',\n  secret: 'YOUR_WEBHOOK_SECRET'\n});`;
    document.getElementById('init-code').textContent = initCode;
    document.getElementById('copy-init-btn').dataset.copy = initCode;

    try {
      const secRes = await apiGet('/api/webhooks/secret');
      const secret = (secRes.data || secRes).secret || '';
      document.getElementById('webhook-secret').textContent = secret || '(미설정)';
      document.getElementById('copy-secret-btn').dataset.copy = secret;
    } catch {
      document.getElementById('webhook-secret').textContent = '(불러오기 실패)';
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showIframeBlocked(url) {
  const container = document.getElementById('iframe-container');
  container.innerHTML = `
    <div class="iframe-blocked">
      <i data-lucide="shield-x" style="width:48px;height:48px;color:var(--color-text-muted);"></i>
      <h3 style="font-size:1rem;">iframe 로드가 차단됨</h3>
      <p class="text-muted" style="max-width:320px;line-height:1.6;font-size:0.875rem;">
        대상 사이트의 X-Frame-Options 또는 CSP 정책으로 인해 iframe에서 로드할 수 없습니다.
        새 탭에서 열어 Agentation을 사용하세요.
      </p>
      <a href="${escHtml(url)}" target="_blank" rel="noopener" class="btn btn-primary">
        <i data-lucide="external-link" style="width:15px;height:15px;"></i>
        새 탭에서 열기
      </a>
    </div>
  `;
  refreshIcons();
}

async function loadFeedback() {
  try {
    const res = await apiGet(`/api/projects/${projectId}/comments?limit=50&sort=created_at&order=desc`);
    const comments = res.data || res;
    comments.forEach(c => knownIds.add(c.id));
    document.getElementById('feedback-count').textContent = comments.length;
    renderFeedback(comments);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function buildFeedbackHtml(c) {
  return `
    ${c.selector ? `<div class="feedback-selector">${escHtml(c.selector)}</div>` : ''}
    <div class="feedback-content">${escHtml(c.content)}</div>
    <div class="feedback-meta">
      <span class="badge ${statusBadge(c.status)}">${statusLabel(c.status)}</span>
      <span style="font-size:0.75rem;color:var(--color-text-muted);">
        ${c.created_by_name ? escHtml(c.created_by_name) : 'Agentation'}
      </span>
      ${c.page_url
        ? `<a href="${escHtml(c.page_url)}" target="_blank" rel="noopener" style="margin-left:auto;">
             <i data-lucide="external-link" style="width:11px;height:11px;"></i>
           </a>`
        : ''
      }
    </div>
  `;
}

function renderFeedback(comments) {
  const list = document.getElementById('feedback-list');
  const empty = document.getElementById('feedback-empty');

  if (!comments.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = comments.map(c => `<div class="feedback-item">${buildFeedbackHtml(c)}</div>`).join('');
  refreshIcons();
}

function statusBadge(s) {
  return s === 'DONE' ? 'badge-done' : s === 'FAILED' ? 'badge-failed' : 'badge-progress';
}
function statusLabel(s) {
  return s === 'DONE' ? '수정 완료' : s === 'FAILED' ? '반려' : '수정 필요';
}

async function exportFeedbackCSV() {
  try {
    const res = await apiGet(`/api/projects/${projectId}/comments?limit=500&sort=created_at&order=desc`);
    const comments = res.data || res;
    const bom = '﻿';
    const header = ['선택자', '내용', '상태', '작성자', '페이지 URL', '생성일'];
    const rows = comments.map(c => [
      `"${(c.selector || '').replace(/"/g, '""')}"`,
      `"${(c.content || '').replace(/"/g, '""')}"`,
      statusLabel(c.status),
      `"${(c.created_by_name || 'Agentation').replace(/"/g, '""')}"`,
      `"${(c.page_url || '').replace(/"/g, '""')}"`,
      new Date(c.created_at).toLocaleDateString('ko-KR')
    ]);
    const csv = bom + [header, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `feedback_${projectId}.csv`;
    a.click();
    showToast('CSV 다운로드 완료', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}
