FROM docker.1panel.dev/node:20-alpine
WORKDIR /app
COPY ../package.json .
RUN ls ./
#COPY ../package*.json .
RUN npm install
EXPOSE 3000
CMD ["npm", "run", "dev"]