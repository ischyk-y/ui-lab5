import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import ScheduleBoard from './components/ScheduleBoard';
import ChatAssistant from './components/ChatAssistant';

const API_BASE = process.env.REACT_APP_API_BASE ?? 'http://localhost:5000';

const initialAssistantMessage = {
  id: 'intro',
  role: 'assistant',
  content: 'Привіт! Я допоможу вести твій розклад. Напиши, що саме додати, змінити або видалити.',
};

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
      <ScheduleBoard
        orderedDays={orderedDays}
        typeLabels={typeLabels}
        onRefresh={fetchSchedule}
        error={error}
      />
      <ChatAssistant
        messages={messages}
        suggestions={suggestions}
        inputValue={inputValue}
        onInputChange={(event) => setInputValue(event.target.value)}
        onSend={handleSend}
        isSending={isSending}
        chatRef={chatRef}
      />
    </div>
  );
}

export default App;
