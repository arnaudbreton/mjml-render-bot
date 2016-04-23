'use strict';

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

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
  var promise = new Promise(function (resolve, reject) {
    (0, _request2.default)({
      url: 'https://api.github.com/gists/' + gist.id + '?access_token=' + _config2.default.crawler.gist_token,
      method: 'GET',
      headers: {
        'User-Agent': 'mjml-gist-crawler'
      }
    }, function (error, response, body) {
      if (error) {
        console.error('Gist ' + gist.id + ' loaded with error ' + error);
        reject();
      } else {
        console.log('Gist ' + gist.id + ' loaded successfully');
        resolve(JSON.parse(body));
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
        recipients: [_config2.default.crawler.recipient]
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
        debugLogger('Gist ' + gistID + ' sent');
        resolve(body);
      }
    });
  });

  return promise;
};

var crawl = function crawl(since) {
  debugLogger('Starting to crawl from', since);
  var promise = new Promise(function (resolve, reject) {
    readGists(since).then(function (gists) {
      return Promise.all(gists);
    }).then(function (gists) {
      return Promise.all(gists.map(function (gist) {
        return readGist(gist);
      }));
    }).then(function (gists) {
      Promise.all(gists.map(function (gist) {
        sendMJMLEmail(gist.id, gist.files.tryItLive.content);
      }));
    }).then(function () {
      setTimeout(function () {
        crawlEmitter.emit('crawl', new Date(since.getTime() + 10 * 60000));
      }, 0.5 * 60000);
    });
  });

  return promise;
};

crawl(new Date(parseInt(_config2.default.crawler.start_date)));
var crawlEmitter = new _events2.default();
crawlEmitter.on('crawl', function (since) {
  crawl(since);
});