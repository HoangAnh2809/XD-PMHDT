FROM python:3.11-slim

WORKDIR /app

# Copy shared module from parent context
COPY shared/ /app/shared/

# Copy service code
COPY payment_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY payment_service/ /app/

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8005", "--reload"]
