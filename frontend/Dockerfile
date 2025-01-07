FROM node:20-alpine
#FROM docker.1panel.dev/node:20-alpine

WORKDIR /app
COPY package*.json .

RUN npm config set registry https://registry.npmjs.org/
RUN npm install --include dev
COPY . /app/
EXPOSE 3000
CMD ["npm", "run", "dev"]