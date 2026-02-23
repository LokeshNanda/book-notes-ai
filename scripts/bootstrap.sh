#!/usr/bin/env bash
# ReadBrain first-time setup
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

echo "📚 ReadBrain bootstrap"
echo ""

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
    echo "   Add your OPENAI_API_KEY to .env"
  else
    echo "⚠️  No .env.example found"
  fi
else
  echo "   .env already exists"
fi

if command -v python3.12 &>/dev/null; then
  PYTHON=python3.12
elif command -v python3 &>/dev/null; then
  PYTHON=python3
else
  echo "❌ Python 3 not found"
  exit 1
fi

echo ""
echo "Creating virtual environment..."
$PYTHON -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt

echo ""
echo "Building graph..."
python scripts/build_graph.py

if [[ -n "$OPENAI_API_KEY" ]] || grep -q "OPENAI_API_KEY=sk-" .env 2>/dev/null; then
  if [[ -t 0 ]]; then
    echo ""
    read -p "Run AI enrichment now? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      python scripts/enrich.py
    fi
  fi
else
  echo ""
  echo "   Set OPENAI_API_KEY in .env to enable AI enrichment"
fi

echo ""
echo "✅ Done! Run: source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "   Then open http://localhost:8000"
