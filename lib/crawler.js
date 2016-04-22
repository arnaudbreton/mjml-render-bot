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

var readGists = function readGists(since) {
  debugLogger('Gist loading...');
  debugLogger('https://api.github.com/users/mjml-tryitlive/gists?access_token==' + _config2.default.crawler.gist_token + '&&since=' + since.toISOString());
  var promise = new Promise(function (resolve, reject) {
    var gistContent = '';
    (0, _request2.default)({
      url: 'https://api.github.com/users/mjml-tryitlive/gists?access_token=' + _config2.default.crawler.gist_token + '&since=' + since.toISOString(),
      method: 'GET',
      headers: {
        'User-Agent': 'mjml-gist-crawler'
      }
    }, function (error, response, body) {
      if (error) {
        debugLogger('Gist loaded with error ' + error);
        reject();
      } else {
        resolve(JSON.parse(body));
      }
    });
  });

  return promise;
};

var readGist = function readGist(gist) {
  debugLogger('Gist loading ' + gist.id + '...');
  var promise = new Promise(function (resolve, reject) {
    (0, _request2.default)({
      url: 'https://api.github.com/gists/' + gist.id + '?access_token==' + _config2.default.crawler.gist_token + '&',
      method: 'GET',
      headers: {
        'User-Agent': 'mjml-gist-crawler'
      }
    }, function (error, response, body) {
      if (error) {
        debugLogger('Gist ' + gist.id + ' loaded with error ' + error);
        reject();
      } else {
        debugLogger('Gist ' + gist.id + ' loaded successfully');
        resolve(JSON.parse(body));
      }
    });
  });

  return promise;
};

var sendMJMLEmail = function sendMJMLEmail(content) {
  console.log('Sending ' + content + ' over email');
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
        debugLogger('Gist not sent');
        reject();
      } else {
        debugLogger('Gist sent');
        resolve(body);
      }
    });
  });

  return promise;
};

var crawl = function crawl(since) {
  var promise = new Promise(function (resolve, reject) {
    readGists(since).then(function (gists) {
      return Promise.all(gists);
    }).then(function (gists) {
      return Promise.all(gists.map(function (gist) {
        return readGist(gist);
      }));
    }).then(function (gists) {
      Promise.all(gists.map(function (gist) {
        sendMJMLEmail(gist.files.tryItLive.content);
      }));
    }).then(function () {
      setTimeout(function () {
        myEmitter.emit('crawl', new Date(since.getTime() + 10 * 60000));
      }, 0.5 * 60000);
    });
  });

  return promise;
};

crawl(new Date(_config2.default.crawler.start_date));
var myEmitter = new _events2.default();
myEmitter.on('crawl', function (since) {
  crawl(since);
});