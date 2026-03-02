from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List

from flask import Flask, jsonify, request
from flask_cors import CORS
from openai import OpenAI

DATA_PATH = Path(__file__).with_name("schedule.json")

DAY_ALIASES = {
    "monday": ["понед", "понеділ"],
    "tuesday": ["вівтор", "вт"],
    "wednesday": ["серед", "ср"],
    "thursday": ["четвер", "чтв", "чт"],
    "friday": ["п'ят", "пят", "пт"],
    "saturday": ["субот", "сб"],
    "sunday": ["неділ", "нд", "нед"],
}

DAY_TITLES = {
    "monday": "Понеділок",
    "tuesday": "Вівторок",
    "wednesday": "Середа",
    "thursday": "Четвер",
    "friday": "П'ятниця",
    "saturday": "Субота",
    "sunday": "Неділя",
}

TYPE_ALIASES = {
    "lecture": ["лекц", "lecture"],
    "lab": ["лаб", "laboratory", "lab"],
    "seminar": ["сем", "seminar"],
    "practice": ["практ", "practice"],
    "other": [],
}
 
SUGGESTED_PROMPTS = [
    'Додай предмет "Програмування" у середу 12:20-13:50 від п. Коваленко',
    'Зміни посилання на Zoom для "Теорія ймовірностей" у четвер',
    'Покажи, що у мене заплановано на п’ятницю',
    'Видали пару "Фізкультура" у вівторок',
]

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is required to run the AI-powered schedule assistant.")

client = OpenAI(api_key=OPENAI_API_KEY)

MODEL_PROMPT = """
Ти особистий асистент українською мовою, який керує тижневим розкладом студента.
Відповідай ТІЛЬКИ валідним JSON без додаткового тексту. Формат:
{
  "action": "add|remove|update|view|clarify",
  "day": "monday|tuesday|wednesday|thursday|friday|saturday|sunday",
  "title": "поточна назва заняття",
  "new_title": "нова назва, якщо користувач просить перейменувати",
  "time": "HH:MM - HH:MM",
  "teacher": "",
  "location": "",
  "link": "",
  "youtube": "",
  "entry_type": "lecture|lab|seminar|other",
  "clarifying_question": "",
  "missing_fields": ["day", "time", "title"]
}
Поля teacher/location/link/youtube/entry_type/new_title необов’язкові: якщо користувач їх не надав, залишай порожні значення і НЕ проси їх спеціально.
Обов’язково вимагай лише день, час та назву предмету.
Якщо користувач хоче перейменувати пару, заповнюй title існуючою назвою (або став пусто, якщо не знаєш) і нову назву клади в new_title.
Якщо користувач просить показати розклад, став action=view та заповни day (або попроси уточнити).
Якщо даних недостатньо для виконання дії (наприклад, немає дня), поверни action=clarify та опиши, що саме потрібно.
Час записуй у форматі HH:MM - HH:MM. Не вигадуй даних.
"""

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


def empty_schedule() -> Dict[str, List[Dict[str, Any]]]:
    return {day: [] for day in DAY_TITLES.keys()}


def ensure_entry_defaults(entry: Dict[str, Any]) -> Dict[str, Any]:
    entry.setdefault("teacher", "")
    entry.setdefault("time", "")
    entry.setdefault("location", "")
    entry.setdefault("link", "")
    entry.setdefault("youtube", "")
    entry.setdefault("entry_type", "other")
    return entry


def normalize_entry_type(raw: str | None) -> str:
    if not raw:
        return "other"
    lower = raw.strip().lower()
    for canonical, aliases in TYPE_ALIASES.items():
        if lower == canonical or any(lower.startswith(alias) for alias in aliases):
            return canonical
    return "other"


def load_schedule() -> Dict[str, List[Dict[str, Any]]]:
    if DATA_PATH.exists():
        try:
            data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return empty_schedule()
        for day, entries in data.items():
            data[day] = [ensure_entry_defaults(entry) for entry in entries]
        return data
    return empty_schedule()


def save_schedule(data: Dict[str, Any]) -> None:
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_day(raw: str | None) -> str | None:
    if not raw:
        return None
    lower = raw.strip().lower()
    if lower in DAY_TITLES:
        return lower
    for day, title in DAY_TITLES.items():
        if lower == title.lower():
            return day
    for day, aliases in DAY_ALIASES.items():
        if any(alias in lower for alias in aliases):
            return day
    return None




def total_entries(data: Dict[str, Any]) -> int:
    return sum(len(entries) for entries in data.values())


def find_entry_indices(data: Dict[str, Any], day: str | None, title: str | None) -> List[tuple[str, int]]:
    matches: List[tuple[str, int]] = []
    target_days = [day] if day else list(data.keys())

    for d in target_days:
        for idx, entry in enumerate(data.get(d, [])):
            if title and title.lower() not in entry.get("title", "").lower():
                continue
            matches.append((d, idx))
    return matches


def single_entry_index_global(data: Dict[str, Any]) -> tuple[str, int] | None:
    total = sum(len(entries) for entries in data.values())
    if total == 1:
        for d, entries in data.items():
            if entries:
                return (d, 0)
    return None


def single_entry_index_for_day(data: Dict[str, Any], day: str | None) -> tuple[str, int] | None:
    if day and len(data.get(day, [])) == 1:
        return (day, 0)
    return None


def sort_day(entries: List[Dict[str, Any]]) -> None:
    entries.sort(key=lambda item: item.get("time", ""))


def extract_json_block(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return {}


def format_history(history: List[Dict[str, str]]) -> str:
    trimmed = history[-8:]
    lines = []
    for entry in trimmed:
        role = entry.get("role", "user")
        label = "Асистент" if role == "assistant" else "Студент"
        content = entry.get("content", "")
        lines.append(f"{label}: {content}")
    return "\n".join(lines)


def interpret_message(message: str, history: List[Dict[str, str]] | None = None) -> Dict[str, Any]:
    schedule_context = json.dumps(schedule, ensure_ascii=False)
    history_context = format_history(history or [])
    response = client.responses.create(
        model=DEFAULT_MODEL,
        input=[
            {"role": "system", "content": MODEL_PROMPT},
            {
                "role": "user",
                "content": (
                    (f"Останні повідомлення:\n{history_context}\n\n" if history_context else "")
                    + "Поточний розклад (JSON):\n"
                    f"{schedule_context}\n\n"
                    f"Запит користувача: {message}"
                ),
            },
        ],
        temperature=0.1,
        max_output_tokens=400,
    )
    payload = extract_json_block(response.output_text or "")
    if not payload:
        raise ValueError("Не вдалося розпізнати запит. Спробуйте сформулювати інакше.")
    return payload


schedule = load_schedule()


@app.get("/api/schedule")
def get_schedule() -> Any:
    normalized = {
        day: [ensure_entry_defaults(dict(entry)) for entry in entries]
        for day, entries in schedule.items()
    }
    return jsonify({"schedule": normalized, "suggestions": SUGGESTED_PROMPTS, "days": DAY_TITLES})


@app.post("/api/chat")
def chat() -> Any:
    data = request.get_json(force=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"reply": "Напишіть, що саме потрібно зробити з розкладом.", "schedule": schedule}), 400

    history = data.get("history")
    normalized_history: List[Dict[str, str]] = []
    if isinstance(history, list):
        for item in history:
            if not isinstance(item, dict):
                continue
            role = item.get("role")
            content = item.get("content")
            if role in {"user", "assistant"} and isinstance(content, str):
                normalized_history.append({"role": role, "content": content})

    try:
        decision = interpret_message(message, normalized_history)
    except ValueError as exc:
        return jsonify({"reply": str(exc), "schedule": schedule})

    action = (decision.get("action") or "").lower()
    day = normalize_day(decision.get("day"))
    title = (decision.get("title") or "").strip() or None
    time_range = (decision.get("time") or "").strip() or None
    new_title = (decision.get("new_title") or "").strip() or None
    teacher = (decision.get("teacher") or "").strip()
    location = (decision.get("location") or "").strip()
    link = (decision.get("link") or "").strip()
    youtube = (decision.get("youtube") or "").strip()
    clarifying_question = (decision.get("clarifying_question") or "").strip()
    raw_type = decision.get("entry_type") or decision.get("type")
    entry_type = normalize_entry_type(raw_type) if raw_type else None
    missing_fields = decision.get("missing_fields") or []

    if action == "clarify":
        reply = clarifying_question or "Поясніть, що саме потрібно змінити в розкладі."
        return jsonify({"reply": reply, "schedule": schedule})

    if action == "view":
        if not day:
            return jsonify({
                "reply": clarifying_question or "Уточніть день, про який хочете дізнатись.",
                "schedule": schedule,
            })
        entries = schedule.get(day, [])
        if not entries:
            text = f"На {DAY_TITLES[day]} нічого не заплановано."
        else:
            lines = [f"{e['time'] or '—'} · {e['title']} ({e.get('teacher') or 'без викладача'})" for e in entries]
            text = f"{DAY_TITLES[day]}:\n" + "\n".join(lines)
        return jsonify({"reply": text, "schedule": schedule})

    if action == "add":
        required_missing = []
        if not day:
            required_missing.append("день")
        if not time_range:
            required_missing.append("час")
        if not title:
            required_missing.append("назву")
        if missing_fields:
            translations = {"day": "день", "time": "час", "title": "назву"}
            required_missing = [translations.get(field, field) for field in missing_fields if field in translations]
        if required_missing:
            text = clarifying_question or f"Щоб додати пару, вкажіть {', '.join(required_missing)}."
            return jsonify({"reply": text, "schedule": schedule})
        entry = {
            "id": str(uuid.uuid4()),
            "title": title,
            "teacher": teacher,
            "time": time_range,
            "location": location,
            "link": link,
            "youtube": youtube,
            "entry_type": entry_type or "other",
        }
        schedule[day].append(entry)
        sort_day(schedule[day])
        save_schedule(schedule)
        reply = f"Додала '{title}' у {DAY_TITLES[day]} ({time_range})."
        return jsonify({"reply": reply, "schedule": schedule})

    if action == "remove":
        matches: List[tuple[str, int]] = []
        if title:
            matches = find_entry_indices(schedule, day, title)
        else:
            fallback = single_entry_index_for_day(schedule, day) or single_entry_index_global(schedule)
            if fallback:
                matches = [fallback]

        if not matches:
            text = clarifying_question or "Вкажіть назву предмету у лапках, щоб його видалити."
            return jsonify({"reply": text, "schedule": schedule})

        d, idx = matches[0]
        removed = schedule[d].pop(idx)
        save_schedule(schedule)
        return jsonify({"reply": f"Видалила '{removed['title']}' із {DAY_TITLES[d]}.", "schedule": schedule})

        save_schedule(schedule)
        return jsonify({"reply": f"Видалила '{entry['title']}' із {DAY_TITLES[entry['day']]}.", "schedule": schedule})

    if action == "update":
        matches: List[tuple[str, int]] = []
        if title:
            matches = find_entry_indices(schedule, day, title)
        else:
            fallback = single_entry_index_for_day(schedule, day) or single_entry_index_global(schedule)
            if fallback:
                matches = [fallback]

        if not matches:
            text = clarifying_question or "Вкажіть назву предмету, який потрібно змінити."
            return jsonify({"reply": text, "schedule": schedule})

        d, idx = matches[0]
        entry = schedule[d][idx]   # ОЦЕ вже реальний запис у schedule
        updated = False

        if time_range:
            entry["time"] = time_range; updated = True
        if teacher:
            entry["teacher"] = teacher; updated = True
        if location:
            entry["location"] = location; updated = True
        if link:
            entry["link"] = link; updated = True
        if youtube:
            entry["youtube"] = youtube; updated = True
        if new_title:
            entry["title"] = new_title; updated = True
        if entry_type:
            entry["entry_type"] = entry_type; updated = True

        if not updated:
            text = clarifying_question or "Скажіть, що саме змінити: час, викладача, посилання..."
            return jsonify({"reply": text, "schedule": schedule})

        sort_day(schedule[d])
        save_schedule(schedule)
        return jsonify({"reply": f"Оновила '{entry['title']}' для {DAY_TITLES[d]}.", "schedule": schedule})

    return jsonify({"reply": "Я поки не розумію цей запит. Спробуйте іншу формулювання.", "schedule": schedule})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
