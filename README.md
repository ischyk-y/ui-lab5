# ui-lab5

Два проекта пятой лабораторной:

1. **lab5-react** — SPA на Create React App, показывает форму и расписание.
2. **lab5-server** — Flask-сервис (или FastAPI?) для маршрутов, использует OpenAI (ключ надо задать через `OPENAI_API_KEY`).

## Структура
- `lab5-react/` — клиентская часть (`package.json`, `public`, `src`).
- `lab5-server/` — сервер на Python с `app.py`, `schedule.json`, `requirements.txt`.
- `.gitignore` исключает `node_modules`, `venv`, артефакты Python.

## Быстрый старт
### lab5-react
```bash
cd lab5-react
npm install
npm start
```
Стартует на `http://localhost:3000`.

### lab5-server
```bash
cd lab5-server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY=sk-...   # ключ не хранится в репозитории
python app.py
```
Сервис слушает на порту 8000/в указанном файле.

## Примечания
- `node_modules/` очищен, поэтому скачай зависимости самостоятельно.
- `OPENAI_API_KEY` обязателен при запуске сервера, задавай его из безопасного хранилища.
