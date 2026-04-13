# Gemini - Freshathor Project

A platform for students to pitch innovative projects and receive funding from donors. Built with Django backend and vanilla JavaScript frontend, with MongoDB for data persistence.

## Features

- **Student Projects**: Post and manage projects
- **Donor Funding**: Support projects you believe in
- **Messaging**: Direct communication between students and donors
- **Admin Dashboard**: Manage users and projects
- **Project Evaluator**: AI-powered project assessment

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Django 4.2+
- **Database**: MongoDB
- **Deployment**: Vercel (Serverless)

## Local Development

### Prerequisites

- Python 3.8+
- Node.js (optional, for frontend tooling)
- MongoDB running locally or MongoDB Atlas connection string

### Setup

1. **Clone the repository**
```bash
git clone <repo-url>
cd Gemini
```

2. **Install backend dependencies**
```bash
cd backend
pip install -r requirements.txt
```

3. **Configure environment variables**
```bash
# Create .env file in root directory
cp .env.example .env
# Edit .env with your MongoDB connection string and other settings
```

4. **Run Django development server**
```bash
cd backend
python manage.py runserver
```

5. **Open in browser**
```
http://localhost:8000
```

## Deployment to Vercel

### Prerequisites for Deployment

- Vercel account (free tier works)
- MongoDB Atlas account (free tier available)
- GitHub/GitLab repository connection

### Deployment Steps

1. **Set up MongoDB Atlas (Cloud Database)**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free cluster
   - Get your connection string (looks like: `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority`)

2. **Connect to Vercel**
   - Go to [Vercel](https://vercel.com)
   - Connect your GitHub/GitLab repository
   - Select this project

3. **Set Environment Variables**
   - In Vercel project settings, add:
     - `DJANGO_SECRET_KEY`: Generate a secure key (e.g., using `django.core.management.utils.get_random_secret_key()`)
     - `MONGO_URI`: Your MongoDB Atlas connection string
     - `MONGO_DB_NAME`: Name of your database (e.g., `gemini_db`)
     - `DEBUG`: Set to `False` for production

4. **Deploy**
   - Push to GitHub
   - Vercel automatically deploys on push
   - Or manually trigger deployment from Vercel dashboard

## API Endpoints

All endpoints are prefixed with `/api/`

### Authentication
- `POST /api/register/` - Register new user
- `POST /api/login/` - Login user
- `POST /api/logout/` - Logout user
- `GET /api/me/` - Get current user info

### Projects
- `GET /api/projects/` - List all projects
- `POST /api/projects/` - Create new project
- `POST /api/projects/<id>/delete/` - Delete project
- `POST /api/projects/<id>/fund/` - Fund a project

### Messages
- `GET /api/messages/` - Get all messages for user
- `POST /api/messages/` - Send a message
- `POST /api/messages/read/` - Mark messages as read

### Users (Admin Only)
- `GET /api/users/` - List all users
- `POST /api/users/promote/` - Promote user to admin
- `DELETE /api/users/` - Delete user

## Troubleshooting

### Vercel 500 Errors
- Check Vercel logs: `vercel logs`
- Ensure MongoDB connection string is correct
- Verify all environment variables are set

### CORS Errors
- Make sure CORS is configured in `backend/gemini/settings.py`
- Check that your Vercel domain is in `CORS_ALLOWED_ORIGINS`

### Database Connection Issues
- Verify MongoDB URI is correct
- Check MongoDB Atlas IP whitelist (allow all IPs for simplicity, or add Vercel IPs)
- Test connection locally first

## Development Tips

- For local development, Django runs in DEBUG mode with a local SQLite database
- On Vercel, uses MongoDB for production-grade data persistence
- All API calls are relative (`/api/*`), making them work both locally and on Vercel

## File Structure

```
Gemini/
├── index.html                 # Landing page
├── login.html                 # Login page
├── register.html              # Registration page
├── student_dashboard.html     # Student dashboard
├── donor_dashboard.html       # Donor dashboard
├── admin.html                 # Admin panel
├── script.js                  # Main application logic
├── style.css                  # Styling
├── backend/                   # Django backend
│   ├── manage.py
│   ├── requirements.txt
│   ├── gemini/                # Main Django app
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── accounts/              # Accounts app
│       ├── views.py
│       └── urls.py
├── api/                       # Vercel serverless handlers
│   └── index.py              # Main API handler
└── vercel.json               # Vercel configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Push and create a Pull Request

## License

MIT
