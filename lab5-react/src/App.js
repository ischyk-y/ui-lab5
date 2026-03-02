import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownIt from 'markdown-it';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE ?? 'http://localhost:5000';

const md = new MarkdownIt({
  linkify: true,
  breaks: true,
});

const initialAssistantMessage = {
  id: 'intro',
  role: 'assistant',
  content: 'Привіт! Я допоможу вести твій розклад. Напиши, що саме додати, змінити або видалити.',
};

const suggestionList = [
  'Додай предмет "Програмування" у середу 12:20-13:50 від п. Коваленко',
  'Зміни посилання на Zoom для "Теорія ймовірностей" у четвер',
  'Покажи, що у мене заплановано на п’ятницю',
  'Видали пару "Фізкультура" у вівторок',
];

const typeLabels = {
  lecture: 'Лекція',
  lab: 'Лаба',
  seminar: 'Семінар',
  practice: 'Практика',
  other: 'Заняття',
};

function App() {
  const [schedule, setSchedule] = useState({});
  const [days, setDays] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [messages, setMessages] = useState([initialAssistantMessage]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const chatRef = useRef(null);

  const fetchSchedule = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/schedule`);
      const data = await response.json();
      setSchedule(data.schedule ?? {});
      setDays(data.days ?? {});
      setSuggestions(data.suggestions ?? []);
      setError('');
    } catch (err) {
      setError('Не вдалося завантажити розклад.');
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const orderedDays = useMemo(() => {
    const keys = Object.keys(days);
    return keys.map((key) => ({
      id: key,
      title: days[key],
      entries: schedule[key] ?? [],
    }));
  }, [days, schedule]);

  const handleSend = async (event) => {
    event.preventDefault();
    const text = inputValue.trim();
    if (!text || isSending) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInputValue('');

    try {
      setIsSending(true);
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: updatedHistory.map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.reply || 'Помилка сервера');
      }
      if (data.schedule) {
        setSchedule(data.schedule);
      }
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply ?? 'Готово!',
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setError('');
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${err.message}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="schedule-panel">
        <header className="panel-header">
          <div>
            <p className="panel-eyebrow">Мій тиждень</p>
            <h1>Розклад університету</h1>
          </div>
          <button type="button" className="ghost" onClick={fetchSchedule}>
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
                        <span className={`slot-chip slot-chip--${entry.entry_type || 'other'}`}>
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

      <section className="chat-panel">
        <header className="chat-header">
          <div>
            <p className="panel-eyebrow">Асистент розкладу</p>
            <h2>Чат керування</h2>
          </div>
          <p className="chat-hint">Описуй зміни природною мовою або обери підказку.</p>
        </header>

        <div className="chat-suggestions">
          {(suggestions.length ? suggestions : suggestionList).map((text) => (
            <button
              type="button"
              key={text}
              className="suggestion"
              onClick={() => setInputValue(text)}
            >
              {text}
            </button>
          ))}
        </div>

        <div className="chat-stream" ref={chatRef}>
          {messages.map((message) => (
            <article
              key={message.id}
              className={`chat-bubble chat-bubble--${message.role}`}
            >
              <p className="chat-meta">{message.role === 'user' ? 'Я' : 'Асистент'}</p>
              <div
                className="chat-text"
                dangerouslySetInnerHTML={{ __html: md.render(message.content) }}
              />
            </article>
          ))}
        </div>

        <form className="chat-composer" onSubmit={handleSend}>
          <textarea
            placeholder="Напишіть, що змінити у розкладі..."
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            rows={3}
          />
          <div className="composer-actions">
            <button type="submit" disabled={!inputValue.trim() || isSending}>
              {isSending ? 'Надсилаю...' : 'Надіслати'}
            </button>
            <p className="composer-hint">
              Підказка: використовуйте ключові слова «додай», «видали», «зміни», час у форматі 10:00-11:30 та назву в лапках.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}

export default App;
