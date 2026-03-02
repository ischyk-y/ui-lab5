import React from 'react';

export default function ScheduleBoard({ orderedDays, typeLabels, onRefresh, error }) {
  return (
    <aside className="schedule-panel">
      <header className="panel-header">
        <div>
          <p className="panel-eyebrow">Мій тиждень</p>
          <h1>Розклад університету</h1>
        </div>
        <button type="button" className="ghost" onClick={onRefresh}>
          Оновити дані
        </button>
      </header>

      {error && <div className="panel-alert">{error}</div>}

      <div className="schedule-board">
        {orderedDays.map((day) => (
          <div key={day.id} className="day-card">
            <h2>{day.title}</h2>
            {day.entries.length === 0 ? (
              <p className="day-empty">Вільно</p>
            ) : (
              day.entries.map((entry) => (
                <article key={entry.id} className="slot-item">
                  <div className="slot-time">{entry.time || '—'}</div>
                  <div className="slot-body">
                    <div className="slot-title-row">
                      <p className="slot-title">{entry.title}</p>
                      <span
                        className={`slot-chip slot-chip--${
                          entry.entry_type || 'other'
                        }`}
                      >
                        {typeLabels[entry.entry_type] || typeLabels.other}
                      </span>
                    </div>
                    {entry.teacher && <p className="slot-sub">{entry.teacher}</p>}
                    <div className="slot-links">
                      {entry.location && <span>{entry.location}</span>}
                      {entry.link && (
                        <a href={entry.link} target="_blank" rel="noreferrer">
                          Посилання
                        </a>
                      )}
                      {entry.youtube && (
                        <a href={entry.youtube} target="_blank" rel="noreferrer">
                          YouTube
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
