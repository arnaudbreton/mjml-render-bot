'use strict';

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _mjml = require('mjml');

var _mjml2 = _interopRequireDefault(_mjml);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var app = (0, _express2.default)();
var Mailjet = require('node-mailjet').connect(_config2.default.mailjet.apikey, _config2.default.mailjet.apisecret);

app.use(_bodyParser2.default.json());

var renderMJML = function renderMJML(mjml) {
  return new Promise(function (resolve, reject) {
    if (!mjml) {
      reject({ "error": "No MJML provided" });
      return;
    } else {
      var html = _mjml2.default.mjml2html(mjml);
      resolve({ "html": html });
      return;
    }
  });
};

app.post('/render', function (req, res) {
  var mjml = req.body.mjml;
  var promise = renderMJML(mjml);

  promise.then(function (html) {
    res.setHeader('Content-Type', 'application/json');
    res.json({ "mjml": mjml, "html": html.html });
  }).catch(function (error) {
    res.setHeader('Content-Type', 'application/json');
    res.status(400);
    res.json(error);
  });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});

app.post('/render-send-email', function (req, res) {
  var mjml = req.body.mjml;
  var recipients = req.body.recipients;

  if (!recipients || recipients.length === 0) {
    res.setHeader('Content-Type', 'application/json');
    res.status(400);
    res.json({ "error": "No recipients provided" });
  }

  var promise = renderMJML(mjml);

  promise.then(function (html) {
    var recipientsMailjet = recipients.map(function (recipient) {
      return { "Email": recipient };
    });
    var emailData = {
      'FromEmail': _config2.default.mailjet.sender,
      'FromName': 'MJML Render Bot',
      'Subject': 'Your MJML rendered',
      'HTML-part': html.html,
      'Recipients': recipientsMailjet
    };

    console.log(emailData);
    var sendEmail = Mailjet.post('send');
    sendEmail.request(emailData).on('success', function () {
      res.setHeader('Content-Type', 'application/json');
      res.json({ "mjml": mjml, "html": html.html, "recipients": recipients });
    }).on('error', function (error, response) {
      res.setHeader('Content-Type', 'application/json');
      res.json({ "error": error });
    });
  }).catch(function (error) {
    res.setHeader('Content-Type', 'application/json');
    res.status(400);
    res.json(error);
  });
});