'use strict';

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var _ioredis = require('ioredis');

var _ioredis2 = _interopRequireDefault(_ioredis);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debugLogger = (0, _debug2.default)('mjml-gist-crawler');

debugLogger('Read config', _config2.default);

var readGists = function readGists(since) {
  var gistURL = 'https://api.github.com/users/mjml-tryitlive/gists?access_token=' + _config2.default.crawler.gist_token + '&&since=' + since.toISOString();
  console.log('Gists loading ' + gistURL + '...');
  var promise = new Promise(function (resolve, reject) {
    var gistContent = '';
    (0, _request2.default)({
      url: gistURL,
      method: 'GET',
      headers: {
        'User-Agent': 'mjml-gist-crawler'
      }
    }, function (error, response, body) {
      if (error) {
        console.log('Gists loaded with error ' + error);
        reject();
      } else {
        console.log('Gists loaded successfully');
        var jsonBody = JSON.parse(body);
        debugLogger(jsonBody);
        resolve(jsonBody);
      }
    });
  });

  return promise;
};

var readGist = function readGist(gist) {
  console.log('Gist loading ' + gist.id + '...');
  var promise = new Promise(function (resolveRead, rejectRead) {
    redisClient.get(gist.id).then(function (lastCrawled) {
      if (lastCrawled) {
        resolveRead({
          id: gist.id,
          ignored: true
        });
      } else {
        (0, _request2.default)({
          url: 'https://api.github.com/gists/' + gist.id + '?access_token=' + _config2.default.crawler.gist_token,
          method: 'GET',
          headers: {
            'User-Agent': 'mjml-gist-crawler'
          }
        }, function (error, response, body) {
          if (error) {
            console.error('Gist ' + gist.id + ' loaded with error ' + error);
            rejectRead();
          } else {
            console.log('Gist ' + gist.id + ' loaded successfully');

            debugLogger('Tagging gist ' + gist.id + ' in Redis, expiring in ' + _config2.default.crawler.gist_expiration_tag + ' seconds');
            redisClient.set(gist.id, new Date().getTime());
            redisClient.expire(gist.id, _config2.default.crawler.gist_expiration_tag);

            resolveRead(JSON.parse(body));
          }
        });
      }
    });
  });

  return promise;
};

var sendMJMLEmail = function sendMJMLEmail(gistID, content) {
  console.log('Sending ' + gistID + ' over email');
  debugLogger('Sending ' + content + ' over email');
  var promise = new Promise(function (resolve, reject) {
    (0, _request2.default)({
      url: _config2.default.crawler.api_base_url + '/render-send-email',
      method: 'POST',
      body: JSON.stringify({
        mjml: content,
        recipients: [_config2.default.crawler.recipient],
        gistID: gistID
      }),
      headers: {
        'User-Agent': 'mjml-gist-crawler',
        'Content-Type': 'application/json'
      }
    }, function (error, response, body) {
      if (error) {
        console.log('Gist ' + gistID + ' not sent');
        reject();
      } else {
        console.log('Gist ' + gistID + ' sent');
        resolve(body);
      }
    });
  });

  return promise;
};

var crawl = function crawl(since) {
  console.log('Starting to crawl from', since);
  var promise = new Promise(function (resolve, reject) {
    readGists(since).then(function (gists) {
      return Promise.all(gists);
    }).then(function (gists) {
      return Promise.all(gists.map(function (gist) {
        return readGist(gist);
      }));
    }).then(function (gists) {
      Promise.all(gists.map(function (gist) {
        if (!gist.ignored) {
          if (gist.files && gist.files.tryItLive) {
            sendMJMLEmail(gist.id, gist.files.tryItLive.content);
          } else {
            console.log("No content for", gist.id);
          }
        } else {
          console.log("Ignoring Gist", gist.id);
        }
      }));
    }).then(function () {
      console.log('Crawling done for ' + since + ', storing last start date to Redis');
      redisClient.set('start_date', since.getTime());
      setTimeout(function () {
        crawlEmitter.emit('crawl', new Date(since.getTime() + 1 * 60000));
      }, 1 * 60000);
    });
  });

  return promise;
};

debugLogger('Connecting to Redis', _config2.default.crawler.redis_url);
var redisClient = new _ioredis2.default();
var crawlEmitter = new _events2.default();
redisClient.get('start_date').then(function (lastStartDate) {
  debugLogger('Read start_date from Redis', lastStartDate);
  var startDate = lastStartDate || _config2.default.crawler.start_date;

  crawl(new Date(parseInt(startDate)));
  crawlEmitter.on('crawl', function (since) {
    crawl(since);
  });
});