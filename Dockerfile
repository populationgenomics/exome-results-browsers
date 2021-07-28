FROM node:14.17.3-buster-slim

RUN mkdir -p /home/node/app && chown -R node:node /home/node/app
WORKDIR /home/node/app

USER node

ENV NODE_ENV=production

# Install dependencies
COPY --chown=node:node package.json .
COPY --chown=node:node src/browsers/package.json src/browsers/package.json
COPY --chown=node:node yarn.lock .
RUN yarn install --production false --frozen-lockfile && yarn cache clean

# Copy frontend source
COPY --chown=node:node babel.config.js .
COPY --chown=node:node src/browsers ./src/browsers

# Build frontend
COPY --chown=node:node build.env .
RUN export $(cat build.env | xargs); yarn run build

###############################################################################
FROM node:14.17.3-buster-slim

# Required to build tensorflow js
RUN export PYTHON=/usr/local/bin/python3
RUN apt-get update && \ 
	apt-get install -y build-essential \
	wget \
	python3 \
	make \
	gcc \ 
	libc6-dev

RUN mkdir -p /home/node/app && chown -R node:node /home/node/app
WORKDIR /home/node/app

USER node

ENV NODE_ENV=production

ENV PORT=8000

# Install dependencies
COPY --chown=node:node src/server/package.json .
COPY --chown=node:node yarn.lock .
RUN yarn install --production --frozen-lockfile && yarn cache clean

# Copy frontend from build stage
COPY --chown=node:node --from=0 /home/node/app/src/server/public ./public

# Copy server source
COPY --chown=node:node src/server .

# Run
CMD ["node", "server.js"]
