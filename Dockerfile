FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application code
COPY app/ ./app/
COPY scripts/ ./scripts/
COPY site/ ./site/
COPY books/ ./books/

# Create output dirs
RUN mkdir -p site/public

EXPOSE 8000

# Startup: enrich new chapters, rebuild graph, then serve
CMD ["sh", "-c", "python scripts/enrich.py && python scripts/build_graph.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
