const PLAN = `<svg class="plan" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
<g fill="none" stroke="var(--canvas-wall)"><path d="M90 60h620v480H90z" stroke-width="10"/><path d="M90 280h250M420 280h290M380 60v220M520 280v260M300 280v260" stroke-width="6"/></g>
<g fill="var(--canvas-label)" font-family="IBM Plex Sans Variable" font-size="12"><text x="200" y="170">Soggiorno</text><text x="540" y="170">Cucina</text><text x="170" y="420">Camera</text><text x="385" y="420">Bagno</text><text x="590" y="420">Camera 2</text></g>
<g fill="none" stroke-width="2" stroke-dasharray="6 4"><path d="M560 76V120H460V230" stroke="var(--run-floor)"/><path d="M380 76V120H230V230" stroke="var(--run-ceiling)"/><path d="M160 300V360H230" stroke="var(--run-direct)"/></g>
<path d="M640 120V230" stroke="var(--accent)" stroke-width="2.5" fill="none"/>
<g stroke="var(--canvas-node)" fill="var(--canvas-bg)" stroke-width="1.6"><circle cx="230" cy="230" r="9"/><path d="M224 224l12 12M236 224l-12 12"/><circle cx="460" cy="230" r="9"/><path d="M454 224l12 12M466 224l-12 12"/><path d="M120 266a10 10 0 0 1 20 0z"/><path d="M200 266a10 10 0 0 1 20 0z"/><path d="M600 266a10 10 0 0 1 20 0z"/><circle cx="230" cy="360" r="9"/><path d="M224 354l12 12M236 354l-12 12"/><rect x="552" y="68" width="16" height="16" rx="2"/><rect x="372" y="68" width="16" height="16" rx="2"/></g>
<path d="M630 266a10 10 0 0 1 20 0z" fill="var(--canvas-bg)" stroke="var(--accent)" stroke-width="2"/><rect x="622" y="248" width="36" height="26" rx="3" fill="none" stroke="var(--accent)" stroke-dasharray="3 2"/>
<text x="648" y="180" font-family="IBM Plex Mono" font-size="11" fill="var(--canvas-label)">4.20 m</text></svg>`;
document.querySelectorAll('.plan-slot').forEach(el => el.insertAdjacentHTML('afterbegin', PLAN));

const root = document.documentElement;
const mq = matchMedia('(prefers-color-scheme: dark)');
let theme = 'light';
function applyTheme() {
  root.dataset.theme = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
  document.querySelectorAll('[data-theme-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeBtn === theme)));
}
document.querySelectorAll('[data-theme-btn]').forEach(b => b.onclick = () => { theme = b.dataset.themeBtn; applyTheme(); });
function show(v) {
  document.querySelectorAll('.variant').forEach(el => el.classList.toggle('on', el.dataset.v === v));
  document.querySelectorAll('[data-v-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vBtn === v)));
  const d = document.querySelector(`.variant[data-v="${v}"]`);
  document.getElementById('desc').textContent = d ? d.dataset.desc : '';
  history.replaceState(null, '', '#' + v);
}
document.querySelectorAll('[data-v-btn]').forEach(b => b.onclick = () => show(b.dataset.vBtn));
const qs = new URLSearchParams(location.search);
if (qs.get('theme')) theme = qs.get('theme');
applyTheme();
show((location.hash || '#A').slice(1));
