import { MOCKS, MOCK_VERSION, fixtureFor } from "./fixtures.js";
import { VALIDATION } from "../runtime.js";
import { esc } from "../ui.js";

if (!VALIDATION) throw new Error("Catálogo disponível somente na versão de validação.");
const $ = id => document.getElementById(id);
const selectedFromUrl = () => MOCKS.find(mock => mock.id === location.hash.slice(1)) ?? MOCKS[0];
let selected = selectedFromUrl();
$('mc-group').insertAdjacentHTML('beforeend', [...new Set(MOCKS.map(mock => mock.group))].map(group => `<option>${esc(group)}</option>`).join(''));
function drawList() {
  const query = $('mc-search').value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const group = $('mc-group').value;
  const shown = MOCKS.filter(mock => (!group || mock.group === group) && `${mock.group} ${mock.title} ${mock.path} ${mock.variant}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query));
  $('mc-count').textContent = `${shown.length} de ${MOCKS.length} exemplos`;
  let previous = '';
  $('mc-list').innerHTML = shown.map(mock => {
    const heading = previous === mock.group ? '' : `<h3>${esc(mock.group)}</h3>`;
    previous = mock.group;
    return `${heading}<button type="button" data-mock="${mock.id}" aria-current="${selected.id === mock.id}">${esc(mock.title)}</button>`;
  }).join('') || '<p>Nenhum exemplo encontrado. Tente outro termo.</p>';
}
function showMock() {
  selected = selectedFromUrl();
  for (const [id, value] of Object.entries({ 'mc-title': selected.title, 'mc-category': selected.group, 'mc-description': selected.description, 'mc-limit': selected.limitation, 'mc-id': selected.id, 'mc-route': `#/${selected.path}`, 'mc-state': selected.variant })) $(id).textContent = value;
  const url = new URL('./index.html', location.href);
  url.searchParams.set('mock', selected.id);
  if (selected.surface === 'mobile') url.searchParams.set('app', '1');
  $('mc-frame').src = url.href;
  $('mc-frame').title = `Mock: ${selected.title}`;
  $('mc-open').href = url.href;
  document.querySelector('.mc-preview').classList.toggle('desktop', selected.surface === 'desktop');
  $('mc-feedback').textContent = '';
  drawList();
}
$('mc-list').addEventListener('click', event => {
  const id = event.target.closest('[data-mock]')?.dataset.mock;
  if (id) location.hash = id;
});
$('mc-search').addEventListener('input', drawList);
$('mc-group').addEventListener('change', drawList);
$('mc-reset').addEventListener('click', () => { $('mc-frame').src = $('mc-open').href; $('mc-feedback').textContent = 'Exemplo restaurado.'; });
$('mc-download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: MOCK_VERSION, mock: selected, state: fixtureFor(selected) }, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `aval-${selected.id}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('mc-feedback').textContent = 'Dados padrão exportados.';
});
$('mc-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(new URL(`#${selected.id}`, location.href).href); $('mc-feedback').textContent = 'Link do mock copiado.'; }
  catch { $('mc-feedback').textContent = `Copie o endereço desta página: ${location.href}`; }
});
window.addEventListener('hashchange', showMock);
showMock();
