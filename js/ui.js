// Modal plumbing shared by AI features and tools.
import { LS } from './state.js';

export let geminiApiKey = localStorage.getItem(LS.geminiKey) || '';
let onApiKeySuccess = null;

const apiKeyModal = () => document.getElementById('api-key-modal');
const infoModal = () => document.getElementById('info-modal');

export function openApiKeyModal(onSuccess) {
  onApiKeySuccess = onSuccess;
  const m = apiKeyModal();
  m.classList.remove('hidden');
  setTimeout(() => { m.style.opacity = '1'; m.querySelector('.modal-content').style.transform = 'scale(1)'; }, 10);
}

export function closeApiKeyModal() {
  const m = apiKeyModal();
  m.style.opacity = '0'; m.querySelector('.modal-content').style.transform = 'scale(0.95)';
  setTimeout(() => m.classList.add('hidden'), 200);
}

export function openInfoModal(content) {
  const m = infoModal();
  document.getElementById('info-modal-content').innerHTML = content;
  m.classList.remove('hidden');
  setTimeout(() => { m.style.opacity = '1'; m.querySelector('.modal-content').style.transform = 'scale(1)'; }, 10);
}

export function closeInfoModal() {
  const m = infoModal();
  m.style.opacity = '0'; m.querySelector('.modal-content').style.transform = 'scale(0.95)';
  setTimeout(() => m.classList.add('hidden'), 200);
}

export function wireModals() {
  document.getElementById('api-key-save').onclick = () => {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key) { alert('Enter a valid key.'); return; }
    geminiApiKey = key; localStorage.setItem(LS.geminiKey, key); closeApiKeyModal();
    if (onApiKeySuccess) { onApiKeySuccess(); onApiKeySuccess = null; }
  };
  document.getElementById('api-key-cancel').onclick = closeApiKeyModal;
  document.getElementById('info-modal-close').onclick = closeInfoModal;
}
