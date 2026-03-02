import React from 'react';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  linkify: true,
  breaks: true,
});

const defaultSuggestions = [
  'Додай предмет "Програмування" у середу 12:20-13:50 від п. Коваленко',
  'Зміни посилання на Zoom для "Теорія ймовірностей" у четвер',
  'Покажи, що у мене заплановано на п’ятницю',
  'Видали пару "Фізкультура" у вівторок',
];

export default function ChatAssistant({
  messages,
  suggestions,
  inputValue,
  onInputChange,
  onSend,
  isSending,
  chatRef,
}) {
  const suggestionItems = suggestions.length ? suggestions : defaultSuggestions;

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div>
          <p className="panel-eyebrow">Асистент розкладу</p>
          <h2>Чат керування</h2>
        </div>
        <p className="chat-hint">Описуй зміни природною мовою або обери підказку.</p>
      </header>

      <div className="chat-suggestions">
        {suggestionItems.map((text) => (
          <button
            type="button"
            key={text}
            className="suggestion"
            onClick={() => onInputChange({ target: { value: text } })}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="chat-stream" ref={chatRef}>
        {messages.map((message) => (
          <article key={message.id} className={`chat-bubble chat-bubble--${message.role}`}>
            <p className="chat-meta">{message.role === 'user' ? 'Я' : 'Асистент'}</p>
            <div
              className="chat-text"
              dangerouslySetInnerHTML={{ __html: md.render(message.content) }}
            />
          </article>
        ))}
      </div>

      <form className="chat-composer" onSubmit={onSend}>
        <textarea
          placeholder="Напишіть, що змінити у розкладі..."
          value={inputValue}
          onChange={onInputChange}
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
  );
}
