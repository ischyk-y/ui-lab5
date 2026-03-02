# ui-lab5

Два приклади з п’ятої лабораторної: React-клієнт для перегляду/редагування розкладу та Python-сервер з API на Flask.

## Структура репозиторію
- `lab5-react/` — Create React App з компонентами `ScheduleBoard` та `ChatAssistant`, калькулює стан, звертається до `/api` для оновлень.
- `lab5-server/` — сервер на Python (Flask), який повертає `schedule.json` і відповідає на запити чату.
- `.gitignore` виключає `node_modules/`, `venv/` та кеші Python.

## Запуск
### lab5-react
```bash
cd lab5-react
npm install
npm start
```
Пропонується використовувати змінну `REACT_APP_API_BASE` для зміни базового URL (за замовчуванням `http://localhost:5000`).

### lab5-server
```bash
cd lab5-server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY=sk-...
python app.py
```
Сервер слухає `/api/schedule` та `/api/chat` і вимагає ключ OpenAI (безпечне зберігання за межами репозиторію).

## Примітки
- React-логіка вже розбита на компоненти, тому можна додати нові панелі або правила в `lab5-react/src/components`.
- Серверна частина містить `schedule.json`; змінюй його вручну для локального тестування.
