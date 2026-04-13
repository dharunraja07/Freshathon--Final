# Gemini Backend

This backend adds Django authentication and MongoDB storage for the existing frontend app.

## Setup

1. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the Django development server:
   ```bash
   python manage.py runserver
   ```
4. Open `http://127.0.0.1:8000/` in your browser.

## MongoDB

The backend expects a MongoDB server running at `mongodb://127.0.0.1:27017` by default.

To change the MongoDB connection, set environment variables:

- `MONGO_URI`
- `MONGO_DB_NAME`

Example:
```bash
set MONGO_URI=mongodb://127.0.0.1:27017
set MONGO_DB_NAME=gemini_db
python manage.py runserver
```

## What is included

- Django project in `backend/gemini`
- Accounts app in `backend/accounts`
- Login/register flow using MongoDB for users
- Session-based authentication
- Frontend templates and static assets served by Django
