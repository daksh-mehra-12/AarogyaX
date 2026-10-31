FROM node:24-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y python3 python3-venv && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
ENV PYTHON="/opt/venv/bin/python"
ENV AAROGYA_PREINSTALLED_PACKAGES="1"
ENV PYTHONDONTWRITEBYTECODE="1"
ENV PYTHONUNBUFFERED="1"
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY package.json bun.lock ./
RUN npm install --no-audit --no-fund --include=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3000
ENV BACKEND_PORT=5000
EXPOSE 3000
CMD ["npm", "start"]
