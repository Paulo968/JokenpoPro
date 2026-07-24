const $ = selector => document.querySelector(selector);

const controls = {
  openButton: $('#mobile-settings-button'),
  dialog: $('#mobile-settings-dialog'),
  desktopMode: $('#mode-select'),
  desktopDifficulty: $('#difficulty-select'),
  desktopTheme: $('#theme-toggle'),
  desktopSound: $('#sound-button'),
  desktopInstallRow: $('#install-row'),
  desktopInstallButton: $('#install-button'),
  mobileMode: $('#mobile-mode-select'),
  mobileDifficulty: $('#mobile-difficulty-select'),
  mobileTheme: $('#mobile-theme-toggle'),
  mobileSound: $('#mobile-sound-button'),
  mobileInstallRow: $('#mobile-install-row'),
  mobileInstallButton: $('#mobile-install-button')
};

function syncFromDesktop() {
  controls.mobileMode.value = controls.desktopMode.value;
  controls.mobileDifficulty.value = controls.desktopDifficulty.value;
  controls.mobileTheme.checked = controls.desktopTheme.checked;
  controls.mobileSound.textContent = controls.desktopSound.textContent;
  controls.mobileSound.setAttribute('aria-pressed', controls.desktopSound.getAttribute('aria-pressed') || 'false');
  controls.mobileInstallRow.hidden = controls.desktopInstallRow.hidden;
}

function dispatchDesktopChange(control) {
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

controls.openButton.addEventListener('click', () => {
  syncFromDesktop();
  controls.dialog.showModal();
});

controls.dialog.addEventListener('click', event => {
  if (event.target === controls.dialog) controls.dialog.close();
});

controls.mobileMode.addEventListener('change', event => {
  controls.desktopMode.value = event.target.value;
  dispatchDesktopChange(controls.desktopMode);
});

controls.mobileDifficulty.addEventListener('change', event => {
  controls.desktopDifficulty.value = event.target.value;
  dispatchDesktopChange(controls.desktopDifficulty);
});

controls.mobileTheme.addEventListener('change', event => {
  controls.desktopTheme.checked = event.target.checked;
  dispatchDesktopChange(controls.desktopTheme);
  syncFromDesktop();
});

controls.mobileSound.addEventListener('click', () => {
  controls.desktopSound.click();
  syncFromDesktop();
});

controls.mobileInstallButton.addEventListener('click', () => {
  controls.desktopInstallButton.click();
});

new MutationObserver(syncFromDesktop).observe(controls.desktopInstallRow, {
  attributes: true,
  attributeFilter: ['hidden']
});

controls.desktopMode.addEventListener('change', syncFromDesktop);
controls.desktopDifficulty.addEventListener('change', syncFromDesktop);
controls.desktopTheme.addEventListener('change', syncFromDesktop);
controls.desktopSound.addEventListener('click', () => queueMicrotask(syncFromDesktop));

syncFromDesktop();