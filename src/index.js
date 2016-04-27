import config from './config'
import bodyParser from 'body-parser'
import { mjml2html } from 'mjml'
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
      try {
        const html = mjml2html(mjml)
        resolve({"html": html})
        return
      }
      catch(e) {
        reject(e)
      }
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

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('MJML Render Bot API on port', listener.address().port);
})

app.post('/render-send-email', (req, res) => {
  const mjml = req.body.mjml
  const recipients = req.body.recipients
  const gistID = req.body.gistID

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
      'Subject': `Your MJML rendered: ${gistID}`,
      'HTML-part': html.html,
      'Recipients': recipientsMailjet
    }

    const sendEmail = Mailjet.post('send')
    sendEmail
    	.request(emailData)
      .on('success', () => {
	console.log("OK sent");
        res.setHeader('Content-Type', 'application/json')
        res.json({"mjml": mjml, "html": html.html, "recipients": recipients})
      })
      .on('error', (error, response) => {
	console.log("Error on sent", error);
        res.setHeader('Content-Type', 'application/json')
        res.json({"error": error})
      })
  })
  .catch((error) => {
    res.setHeader('Content-Type', 'application/json')
    res.status(400)
    res.json({"error": error})
  })
})
