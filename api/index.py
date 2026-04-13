from asgiref.wsgi import WsgiToAsgi
from django.core.wsgi import get_wsgi_application
import django
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = str(Path(__file__).resolve().parent.parent / 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gemini.settings')

django.setup()


# Get WSGI app and convert to ASGI
wsgi_app = get_wsgi_application()
app = WsgiToAsgi(wsgi_app)

# Vercel handler


async def handler(request):
    return await app(request)
