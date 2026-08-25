FROM node:24-alpine

WORKDIR /app
COPY gateway.mjs ./gateway.mjs

ENV NODE_ENV=production
ENV PORT=8080
ENV PHONEINFOGA_UPSTREAM=http://phoneinfoga:5000

USER node
EXPOSE 8080
CMD ["node", "gateway.mjs"]
