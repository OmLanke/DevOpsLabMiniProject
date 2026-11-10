const $ = (id) => document.getElementById(id);
const MAX_JSON_BYTES = 32 * 1024;
const encoder = new TextEncoder();

const ui = {
  layout: document.querySelector('.workspace-layout'),
  main: document.querySelector('.main-area'),
  rail: document.querySelector('.workspace-rail'),
  health: $('health-status'),
  healthDot: $('health-indicator'),
  refreshStatus: $('refreshStatus'),
  refresh: $('refreshButton'),
  newNote: $('newNoteButton'),
  notesPanel: $('notesPanel'),
  noteCount: $('noteCount'),
  search: $('noteSearch'),
  sort: $('noteSort'),
  list: $('notesList'),
  loading: $('loadingState'),
  loadError: $('loadError'),
  retry: $('retryButton'),
  refreshError: $('refreshError'),
  refreshRetry: $('refreshRetryButton'),
  noNotes: $('noNotes'),
  noResults: $('noResults'),
  outside: $('selectionOutside'),
  showSelected: $('showSelectedButton'),
  clearSearch: $('clearSearchButton'),
  noNotesNew: $('noNotesNewButton'),
  emptyNew: $('emptyNewButton'),
  editorEmpty: $('editorEmpty'),
  editorForm: $('editorForm'),
  back: $('backButton'),
  title: $('noteTitle'),
  content: $('noteContent'),
  noteKind: $('noteKind'),
  noteMeta: $('noteMeta'),
  words: $('wordCount'),
  payload: $('payloadStatus'),
  saveState: $('saveState'),
  saveError: $('saveError'),
  save: $('saveButton'),
  remove: $('deleteButton'),
  recovery: $('recoveryDialog'),
  recoveryOpen: $('recoveryOpen'),
  recoveryClose: $('recoveryClose'),
  recoveryDone: $('recoveryDone'),
  announcement: $('announcement'),
};

const state = {
  notes: [],
  selectedId: null,
  draft: null,
  baseline: null,
  isNew: false,
  query: '',
  sort: 'updated',
  hasLoaded: false,
  loading: false,
  refreshing: false,
  loadError: false,
  refreshError: false,
  busy: '',
  saveError: '',
  lastUpdated: null,
  mobileView: window.matchMedia('(max-width: 760px)').matches ? 'list' : 'detail',
  healthCheck: false,
};

function normalizeNote(note) {
  return {
    id: String(note.id),
    title: typeof note.title === 'string' ? note.title : '',
    content: typeof note.content === 'string' ? note.content : '',
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  };
}

function wordCount(text) {
  const trimmed = text.trim();
  return trimmed ? (trimmed.match(/\S+/gu) || []).length : 0;
}

function payloadForDraft() {
  if (!state.draft) return { title: '', content: '' };
  return { title: state.draft.title.trim(), content: state.draft.content };
}

function payloadSize() {
  return encoder.encode(JSON.stringify(payloadForDraft())).length;
}

function isDirty() {
  if (!state.draft) return false;
  if (state.isNew) return Boolean(state.draft.title || state.draft.content);
  return state.draft.title !== state.baseline?.title || state.draft.content !== state.baseline?.content;
}

function working() {
  return Boolean(state.busy || state.loading || state.refreshing);
}

function canLeaveDraft() {
  if (working()) return false;
  if (!isDirty()) return true;
  if (state.isNew) return window.confirm('Discard this unsaved note?');
  const title = state.draft.title.trim() || 'Untitled note';
  return window.confirm(`Discard unsaved changes to “${title}”?`);
}

function dateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function shortDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  const now = new Date();
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value));
}

function announce(message) {
  ui.announcement.textContent = '';
  window.requestAnimationFrame(() => { ui.announcement.textContent = message; });
}

function setHealth(connected) {
  ui.health.textContent = connected ? 'Database connected' : 'Database unavailable';
  ui.healthDot.classList.toggle('health-connected', connected);
  ui.healthDot.classList.toggle('health-unavailable', !connected);
  ui.healthDot.classList.remove('health-checking');
}

async function checkHealth() {
  if (state.healthCheck) return;
  state.healthCheck = true;
  try {
    const response = await fetch('/health', { cache: 'no-store' });
    const result = response.ok ? await response.json() : null;
    setHealth(result?.status === 'ok' && result?.database === 'connected');
  } catch {
    setHealth(false);
  } finally {
    state.healthCheck = false;
  }
}

function sortedNotes() {
  const notes = [...state.notes];
  if (state.sort === 'title') {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    notes.sort((a, b) => collator.compare(displayNote(a).title, displayNote(b).title));
  } else {
    notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || b.id.localeCompare(a.id));
  }
  return notes;
}

function displayNote(note) {
  if (state.draft && !state.isNew && note.id === state.selectedId) {
    return { ...note, title: state.draft.title, content: state.draft.content, dirty: isDirty() };
  }
  return note;
}

function makeNoteRow(note) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  const title = document.createElement('span');
  const preview = document.createElement('span');
  const meta = document.createElement('span');

  button.type = 'button';
  button.className = 'note-row';
  button.dataset.noteId = note.id;
  button.setAttribute('aria-current', note.id === state.selectedId ? 'true' : 'false');
  button.disabled = working();
  title.className = 'note-row-title';
  title.textContent = note.title.trim() || 'Untitled note';
  preview.className = 'note-row-preview';
  preview.textContent = note.content.replace(/\s+/gu, ' ').trim().slice(0, 110) || 'No note text';
  meta.className = 'note-row-meta';
  meta.textContent = `Updated ${shortDate(note.updatedAt)} · ${wordCount(note.content)} ${wordCount(note.content) === 1 ? 'word' : 'words'}`;
  button.setAttribute('aria-label', `${title.textContent}. ${preview.textContent}. ${meta.textContent}${note.dirty ? '. Unsaved changes' : ''}`);
  button.append(title, preview, meta);
  button.addEventListener('click', () => openNote(note.id));
  item.append(button);
  return item;
}

function renderList() {
  ui.loading.hidden = !state.loading;
  ui.loadError.hidden = state.hasLoaded || !state.loadError;
  ui.list.hidden = !state.hasLoaded;
  ui.noNotes.hidden = !state.hasLoaded || state.notes.length > 0;
  ui.refreshError.hidden = !state.hasLoaded || !state.refreshError;
  ui.search.disabled = !state.hasLoaded || working();
  ui.sort.disabled = !state.hasLoaded || working();
  ui.retry.disabled = working();
  ui.refreshRetry.disabled = Boolean(state.busy || state.refreshing);

  if (!state.hasLoaded) {
    ui.noteCount.textContent = state.loadError ? 'Unavailable' : 'Loading…';
    ui.noResults.hidden = true;
    ui.outside.hidden = true;
    ui.list.replaceChildren();
    return;
  }

  const query = state.query.trim().toLocaleLowerCase();
  const visible = sortedNotes().map(displayNote).filter((note) => {
    return !query || `${note.title}\n${note.content}`.toLocaleLowerCase().includes(query);
  });
  const selectedVisible = visible.some((note) => note.id === state.selectedId);
  const hasOutsideSelection = Boolean(query && state.selectedId && !selectedVisible && state.notes.some((note) => note.id === state.selectedId));
  ui.outside.hidden = !hasOutsideSelection;
  ui.noResults.hidden = state.notes.length === 0 || !query || visible.length > 0;
  ui.noteCount.textContent = query
    ? `${visible.length} of ${state.notes.length} ${state.notes.length === 1 ? 'note' : 'notes'}`
    : `${state.notes.length} ${state.notes.length === 1 ? 'note' : 'notes'}`;
  ui.list.replaceChildren(...visible.map(makeNoteRow));

  if (state.refreshing) ui.refreshStatus.textContent = 'Refreshing…';
  else if (state.lastUpdated) ui.refreshStatus.textContent = `Updated ${formatTime(state.lastUpdated)}`;
  else if (state.loadError) ui.refreshStatus.textContent = 'Couldn’t load notes';
  else ui.refreshStatus.textContent = 'Loading notes…';
}

function renderEditor() {
  const hasDraft = Boolean(state.draft);
  ui.layout.dataset.mobileView = state.mobileView;
  ui.noNotesNew.disabled = working();
  ui.emptyNew.disabled = working();
  ui.editorEmpty.hidden = hasDraft;
  ui.editorForm.hidden = !hasDraft;
  ui.save.disabled = !hasDraft || working() || !isDirty() || !state.draft.title.trim() || !state.draft.content.trim() || payloadSize() > MAX_JSON_BYTES;
  ui.save.textContent = state.isNew ? 'Create note' : 'Save changes';
  ui.saveState.textContent = state.busy === 'save' ? 'Saving…' : isDirty() ? 'Unsaved changes' : 'All changes saved';
  ui.remove.hidden = !hasDraft || state.isNew;
  ui.remove.disabled = working();
  ui.back.disabled = working();
  ui.newNote.disabled = working();
  ui.refresh.disabled = Boolean(state.busy || state.refreshing || state.loading);
  ui.title.disabled = working();
  ui.content.disabled = working();
  ui.saveError.hidden = !state.saveError;
  ui.saveError.textContent = state.saveError;

  if (!hasDraft) return;
  if (document.activeElement !== ui.title) ui.title.value = state.draft.title;
  if (document.activeElement !== ui.content) ui.content.value = state.draft.content;
  ui.noteKind.textContent = state.isNew ? 'Unsaved draft' : 'Lab note';
  if (state.isNew) {
    ui.noteMeta.textContent = 'New note · not saved yet';
  } else {
    const note = state.notes.find((item) => item.id === state.selectedId);
    ui.noteMeta.textContent = note
      ? `Created ${dateTime(note.createdAt)} · Updated ${dateTime(note.updatedAt)}`
      : 'This note is no longer in the saved list';
  }
  const words = wordCount(state.draft.content);
  ui.words.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  const bytes = payloadSize();
  ui.payload.textContent = `${bytes.toLocaleString()} / 32,768 bytes`;
  ui.payload.dataset.overLimit = String(bytes > MAX_JSON_BYTES);
  ui.layout.dataset.mobileView = state.mobileView;
}

function render() {
  renderList();
  renderEditor();
}

function setDraft(note) {
  state.selectedId = note.id;
  state.draft = { title: note.title, content: note.content };
  state.baseline = { ...state.draft };
  state.isNew = false;
  state.saveError = '';
}

function openNote(id) {
  if (working()) return;
  if (state.selectedId === id && !state.isNew) {
    state.mobileView = 'detail';
    renderEditor();
    return;
  }
  if (!canLeaveDraft()) return;
  const note = state.notes.find((item) => item.id === id);
  if (!note) return;
  setDraft(note);
  state.mobileView = 'detail';
  render();
}

function startNewNote() {
  if (!canLeaveDraft()) return;
  state.selectedId = null;
  state.draft = { title: '', content: '' };
  state.baseline = null;
  state.isNew = true;
  state.saveError = '';
  state.mobileView = 'detail';
  render();
  ui.title.focus();
}

function clearDraft() {
  state.selectedId = null;
  state.draft = null;
  state.baseline = null;
  state.isNew = false;
  state.saveError = '';
}

async function loadNotes() {
  if (state.busy || state.refreshing || state.loading) return;
  const initial = !state.hasLoaded;
  state.loadError = false;
  state.refreshError = false;
  state.loading = initial;
  state.refreshing = !initial;
  render();
  try {
    const response = await fetch('/notes', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error('Unexpected notes response');
    const selectedId = state.selectedId;
    state.notes = result.map(normalizeNote);
    state.hasLoaded = true;
    state.lastUpdated = Date.now();
    const selected = state.notes.find((note) => note.id === selectedId);
    if (selected) setDraft(selected);
    else {
      clearDraft();
      const first = state.mobileView === 'list' ? null : sortedNotes()[0];
      if (first) setDraft(first);
    }
    state.loadError = false;
    state.refreshError = false;
  } catch {
    if (initial) state.loadError = true;
    else state.refreshError = true;
  } finally {
    state.loading = false;
    state.refreshing = false;
    render();
  }
}

function refreshNotes() {
  if (!canLeaveDraft()) return;
  loadNotes();
  checkHealth();
}

async function saveDraft(event) {
  event?.preventDefault();
  if (!state.draft || working()) return;
  const payload = payloadForDraft();
  if (!payload.title) {
    state.saveError = 'Add a title before saving.';
    renderEditor();
    ui.title.focus();
    return;
  }
  if (!payload.content.trim()) {
    state.saveError = 'Add some note text before saving.';
    renderEditor();
    ui.content.focus();
    return;
  }
  const body = JSON.stringify(payload);
  const bytes = encoder.encode(body).length;
  if (bytes > MAX_JSON_BYTES) {
    state.saveError = `This note uses ${bytes.toLocaleString()} JSON bytes; the limit is 32,768. Shorten it and save again.`;
    renderEditor();
    ui.content.focus();
    return;
  }

  state.busy = 'save';
  state.saveError = '';
  render();
  try {
    const isCreating = state.isNew;
    const path = isCreating ? '/notes' : `/notes/${encodeURIComponent(state.selectedId)}`;
    // shortcut: shared edits are last-write-wins; add conflict checks when simultaneous editing matters.
    const response = await fetch(path, {
      method: isCreating ? 'POST' : 'PUT',
      headers: { 'content-type': 'application/json' },
      body,
    });
    if (response.status === 413) throw new Error('too-large');
    if (!response.ok) throw new Error(String(response.status));
    const result = await response.json();
    if (result?.id == null) throw new Error('invalid-response');
    const saved = normalizeNote(result);
    if (isCreating) state.notes.push(saved);
    else state.notes = state.notes.map((note) => note.id === saved.id ? saved : note);
    setDraft(saved);
    state.lastUpdated = Date.now();
    state.refreshError = false;
    announce(isCreating ? 'Note created and saved.' : 'Note saved.');
  } catch (error) {
    state.saveError = error.message === 'too-large'
      ? 'The server rejected this note as over 32 KB. Your draft is still here; shorten it and save again.'
      : error.message === '400'
        ? 'The server needs a title and note text. Your draft is still here.'
        : error.message === '404'
          ? 'This note is no longer available on the server. Your draft is still here; refresh the notes list to check.'
          : 'Couldn’t save this note. Your draft is still here; try again.';
  } finally {
    state.busy = '';
    render();
  }
}

async function deleteNote() {
  if (!state.selectedId || !state.draft || state.isNew || working()) return;
  const title = state.draft.title.trim() || 'Untitled note';
  const prompt = isDirty()
    ? `Delete “${title}” and discard your unsaved changes? This removes the note from the shared workspace.`
    : `Delete “${title}” from the shared workspace? This can’t be undone.`;
  if (!window.confirm(prompt)) return;
  const id = state.selectedId;
  state.busy = 'delete';
  state.saveError = '';
  render();
  try {
    const response = await fetch(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(String(response.status));
    state.notes = state.notes.filter((note) => note.id !== id);
    clearDraft();
    state.mobileView = 'list';
    state.lastUpdated = Date.now();
    const next = sortedNotes()[0];
    if (next && !window.matchMedia('(max-width: 760px)').matches) setDraft(next);
    announce(`Deleted ${title}.`);
  } catch (error) {
    state.saveError = error.message === '404'
      ? 'This note is already missing from the shared workspace. Your current draft remains open; refresh the list to check.'
      : 'Couldn’t delete this note. Your draft is still here; try again.';
  } finally {
    state.busy = '';
    render();
  }
}

function backToList() {
  if (working()) return;
  state.mobileView = 'list';
  renderEditor();
}

function openRecovery() {
  if (typeof ui.recovery.showModal === 'function') ui.recovery.showModal();
}

function closeRecovery() {
  ui.recovery.close();
  ui.recoveryOpen.focus();
}

ui.newNote.addEventListener('click', startNewNote);
ui.noNotesNew.addEventListener('click', startNewNote);
ui.emptyNew.addEventListener('click', startNewNote);
ui.refresh.addEventListener('click', refreshNotes);
ui.retry.addEventListener('click', loadNotes);
ui.refreshRetry.addEventListener('click', refreshNotes);
ui.back.addEventListener('click', backToList);
ui.remove.addEventListener('click', deleteNote);
ui.editorForm.addEventListener('submit', saveDraft);
ui.search.addEventListener('input', () => {
  state.query = ui.search.value;
  renderList();
});
ui.sort.addEventListener('change', () => {
  state.sort = ui.sort.value;
  renderList();
});
ui.title.addEventListener('input', () => {
  if (!state.draft) return;
  state.draft.title = ui.title.value;
  state.saveError = '';
  ui.title.removeAttribute('aria-invalid');
  renderEditor();
  renderList();
});
ui.content.addEventListener('input', () => {
  if (!state.draft) return;
  state.draft.content = ui.content.value;
  state.saveError = '';
  ui.content.removeAttribute('aria-invalid');
  renderEditor();
  renderList();
});
ui.showSelected.addEventListener('click', () => {
  ui.search.value = '';
  state.query = '';
  renderList();
  ui.search.focus();
});
ui.clearSearch.addEventListener('click', () => {
  ui.search.value = '';
  state.query = '';
  renderList();
  ui.search.focus();
});
ui.recoveryOpen.addEventListener('click', openRecovery);
ui.recoveryClose.addEventListener('click', closeRecovery);
ui.recoveryDone.addEventListener('click', closeRecovery);
ui.recovery.addEventListener('click', (event) => {
  if (event.target === ui.recovery) closeRecovery();
});
ui.recovery.addEventListener('close', () => ui.recoveryOpen.focus());

window.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 's') {
    event.preventDefault();
    saveDraft();
  }
});

window.addEventListener('beforeunload', (event) => {
  if (!isDirty()) return;
  event.preventDefault();
  event.returnValue = '';
});

window.matchMedia('(max-width: 760px)').addEventListener('change', (event) => {
  if (event.matches && state.selectedId === null && !state.isNew) state.mobileView = 'list';
  if (!event.matches) state.mobileView = 'detail';
  renderEditor();
});

render();
Promise.all([loadNotes(), checkHealth()]);
window.setInterval(checkHealth, 60_000);
