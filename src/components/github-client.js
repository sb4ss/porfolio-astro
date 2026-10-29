import { currentLanguage, setLocalizedText } from '../i18n/client.js';

export function initializeGithub() {
  const calendar = document.querySelector('[data-calendar]');
  const placeholder = document.querySelector('[data-calendar-placeholder]');
  const repoStatus = document.querySelector('[data-repo-status]');
  const activityStatus = document.querySelector('[data-activity-status]');
  let activity;
  let started = false;
  const number = value => new Intl.NumberFormat(currentLanguage()).format(value);
  function localized(element, en, es) {
    element.dataset.i18nEn = en;
    element.dataset.i18nEs = es;
    element.textContent = currentLanguage() === 'es' ? es : en;
  }
  function snapshot(element, date) {
    const format = language => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
    localized(element, 'GitHub snapshot: ' + format('en'), 'Datos de GitHub: ' + format('es'));
  }
  function renderCalendar() {
    if (!activity || !calendar) return;
    const { days, total, activeDays, fetchedAt } = activity;
    document.querySelector('[data-contribution-total]').textContent = total === null ? '—' : number(total);
    document.querySelector('[data-active-days]').textContent = number(activeDays);
    const monthRow = calendar.querySelector('[data-calendar-months]');
    const dayGrid = calendar.querySelector('[data-calendar-days]');
    const startOffset = new Date(days[0].date + 'T12:00:00Z').getUTCDay();
    const weeks = Math.ceil((startOffset + days.length) / 7);
    calendar.style.setProperty('--weeks', weeks);
    const cells = document.createDocumentFragment();
    for (let i = 0; i < startOffset; i++) {
      const spacer = document.createElement('span');
      spacer.className = 'calendar-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      cells.append(spacer);
    }
    const dateFormat = new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'long', timeZone: 'UTC' });
    days.forEach(day => {
      const cell = document.createElement('span');
      cell.className = 'contribution-day';
      cell.dataset.level = day.level;
      cell.setAttribute('role', 'listitem');
      const date = dateFormat.format(new Date(day.date + 'T12:00:00Z'));
      const count = day.count === null
        ? (currentLanguage() === 'es' ? 'Nivel de actividad: ' : 'Activity level: ') + day.level + '/4'
        : number(day.count) + (currentLanguage() === 'es' ? ' contribuciones' : ' contributions');
      cell.title = date + ': ' + count;
      cell.setAttribute('aria-label', cell.title);
      cells.append(cell);
    });
    dayGrid.replaceChildren(cells);
    const labels = document.createDocumentFragment();
    let previousMonth;
    let previousColumn = -4;
    days.forEach((day, index) => {
      const date = new Date(day.date + 'T12:00:00Z');
      const month = date.getUTCMonth();
      const column = Math.floor((startOffset + index) / 7);
      if (month !== previousMonth) {
        if (index === 0 && date.getUTCDate() > 7) {
          previousMonth = month;
          return;
        }
        // Avoid overlapping the first partial month's label.
        if (column - previousColumn >= 3 && column < weeks - 2) {
          const label = document.createElement('span');
          label.textContent = new Intl.DateTimeFormat(currentLanguage(), { month: 'short', timeZone: 'UTC' }).format(date);
          label.style.gridColumn = String(column + 1);
          labels.append(label);
          previousColumn = column;
        }
        previousMonth = month;
      }
    });
    monthRow.replaceChildren(labels);
    placeholder.hidden = true;
    calendar.hidden = false;
    snapshot(activityStatus, fetchedAt);
  }
  function unavailable() {
    if (repoStatus) setLocalizedText(repoStatus, 'Statistics are temporarily unavailable. View the repository on GitHub.');
    if (placeholder) setLocalizedText(placeholder, 'The calendar is temporarily unavailable. View my activity on GitHub.');
    if (activityStatus) setLocalizedText(activityStatus, 'GitHub is not responding right now.');
  }
  async function load() {
    if (started) return;
    started = true;
    try {
      const response = await fetch('/api/github.json', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      unavailable();
      if (data.repository) {
        for (const key of ['stars', 'forks', 'issues']) {
          const target = document.querySelector('[data-repo-stat="' + key + '"]');
          if (target) target.textContent = number(data.repository[key]);
        }
        snapshot(repoStatus, data.repository.fetchedAt);
      }
      if (data.activity?.days?.length) {
        activity = data.activity;
        renderCalendar();
      }
    } catch { unavailable(); }
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      load();
    }
  }, { rootMargin: '300px' });
  document.querySelectorAll('.featured-tuki, #github').forEach(element => observer.observe(element));
  document.addEventListener('portfolio:language', renderCalendar);
}
