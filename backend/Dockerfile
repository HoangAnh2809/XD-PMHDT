FROM python:3.11-slim

WORKDIR /app

# Copy shared module from parent context
COPY shared/ /app/shared/

# Copy service code
COPY api_gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api_gateway/ /app/

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
