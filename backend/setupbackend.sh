#!/bin/bash
echo "Setting up Heyday backend..."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo "Backend setup complete!"