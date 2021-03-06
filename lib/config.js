"use strict";

var config = {
  "mailjet": {
    "apikey": process.env.MJ_APIKEY_PUBLIC,
    "apisecret": process.env.MJ_APIKEY_PRIVATE,
    "sender": process.env.MJML_RENDER_BOT_SENDER
  },
  "crawler": {
    "recipient": process.env.MJML_RENDER_BOT_RECIPIENT,
    "gist_token": process.env.MJML_RENDER_BOT_GIST_TOKEN,
    "start_date": process.env.MJML_RENDER_BOT_START_DATE || 1454544000000,
    "api_base_url": process.env.MJML_RENDER_BOT_API_BASE_URL,
    "redis_url": process.env.REDIS_URL || null,
    "gist_expiration_tag": 60 * 60
  }
};

module.exports = config;