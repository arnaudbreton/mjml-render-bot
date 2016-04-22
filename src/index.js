import config from './config'
import bodyParser from 'body-parser'
import mjmlEngine from 'mjml'
import express from 'express'

const app = express()
const Mailjet = require('node-mailjet').connect(config.mailjet.apikey, config.mailjet.apisecret)

app.use(bodyParser.json())

const renderMJML = (mjml) => {
  return new Promise((resolve, reject) => {
    if (!mjml) {
      reject({"error": "No MJML provided"})
      return
    }
    else {
      const html = mjmlEngine.mjml2html(mjml)
      resolve({"html": html})
      return
    }
  })
}

app.post('/render', (req, res) => {
  const mjml = req.body.mjml
  const promise = renderMJML(mjml)

  promise.then((html) => {
    res.setHeader('Content-Type', 'application/json')
    res.json({"mjml": mjml, "html": html.html})
  })
  .catch((error) => {
    res.setHeader('Content-Type', 'application/json')
    res.status(400)
    res.json(error)
  })
})

app.listen(process.env.PORT || 3000, () => {
  console.log('MJML Render Bot API on port', app.get('port'));
})

app.post('/render-send-email', (req, res) => {
  const mjml = req.body.mjml
  const recipients = req.body.recipients

  if (!recipients || recipients.length === 0) {
    res.setHeader('Content-Type', 'application/json')
    res.status(400)
    res.json({"error": "No recipients provided"})
  }

  const promise = renderMJML(mjml)

  promise.then((html) => {
    const recipientsMailjet = recipients.map((recipient) => { return {"Email": recipient}})
    const emailData = {
      'FromEmail': config.mailjet.sender,
      'FromName': 'MJML Render Bot',
      'Subject': 'Your MJML rendered',
      'HTML-part': html.html,
      'Recipients': recipientsMailjet
    }

    console.log(emailData)
    const sendEmail = Mailjet.post('send')
    sendEmail
    	.request(emailData)
      .on('success', () => {
        res.setHeader('Content-Type', 'application/json')
        res.json({"mjml": mjml, "html": html.html, "recipients": recipients})
      })
      .on('error', (error, response) => {
        res.setHeader('Content-Type', 'application/json')
        res.json({"error": error})
      })
  })
  .catch((error) => {
    res.setHeader('Content-Type', 'application/json')
    res.status(400)
    res.json(error)
  })
})
