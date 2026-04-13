#!/bin/bash
# Vercel automatically installs requirements.txt via uv
# Just run Django static file collection
python backend/manage.py collectstatic --noinput || true
