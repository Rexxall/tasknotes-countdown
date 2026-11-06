(async () => {
  const w = require('@electron/remote').getCurrentWindow();
  w.setContentSize(1280, 780); w.show(); w.focus();
  document.querySelectorAll('.modal-close-button').forEach(b => b.click());
  const p = app.plugins.plugins['tasknotes-countdown'];
  p.settings.hoursPerDay = 1; await p.saveSettings?.(); p.refresh?.();
  app.workspace.getLeavesOfType('tasknotes-countdown-sidebar').forEach(l => l.detach());
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(app.vault.getAbstractFileByPath('TaskNotes/Views/Countdown.base'));
  app.workspace.iterateAllLeaves(l => { if (l !== leaf && l.getRoot() === app.workspace.rootSplit) l.detach(); });
  app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse();
  window.__card = null;
  navigator.clipboard.write = async items => { const b = await items[0].getType('image/png'); window.__card = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); };
  return [innerWidth, innerHeight, Object.keys(p.settings)];
})()
