FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy rest of the application
COPY . /app/

EXPOSE 3000

CMD ["yarn", "dev"]