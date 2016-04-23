import request from 'request'
import debug from 'debug'
import EventEmitter from 'events'
import config from './config'
const debugLogger = debug('mjml-gist-crawler')

debugLogger('Read config', config)

const readGists = (since) => {
    const gistURL = `https://api.github.com/users/mjml-tryitlive/gists?access_token=${config.crawler.gist_token}&&since=${since.toISOString()}`
    console.log(`Gists loading ${gistURL}...`)
    const promise = new Promise((resolve, reject) => {
      let gistContent = ''
      request(
        {
          url: gistURL,
          method: 'GET',
          headers: {
            'User-Agent': 'mjml-gist-crawler'
          }
        },
        (error, response, body) => {
          if (error) {
            console.log(`Gists loaded with error ${error}`)
            reject()
          } else {
            console.log('Gists loaded successfully')
            const jsonBody = JSON.parse(body)
            debugLogger(jsonBody)
            resolve(jsonBody)
          }
      })
    })

    return promise
}

const readGist = (gist) => {
  console.log(`Gist loading ${gist.id}...`)
  const promise = new Promise((resolve, reject) => {
    request(
      {
        url: `https://api.github.com/gists/${gist.id}?access_token=${config.crawler.gist_token}`,
        method: 'GET',
        headers: {
          'User-Agent': 'mjml-gist-crawler'
        }
      },
      (error, response, body) => {
        if (error) {
          console.error(`Gist ${gist.id} loaded with error ${error}`)
          reject()
        } else {
          console.log(`Gist ${gist.id} loaded successfully`)
          resolve(JSON.parse(body))
        }
    })
  })

  return promise
}

const sendMJMLEmail = (gistID, content) => {
  console.log(`Sending ${gistID} over email`)
  debugLogger(`Sending ${content} over email`)
  const promise = new Promise((resolve, reject) => {
    request(
      {
        url: `${config.crawler.api_base_url}/render-send-email`,
        method: 'POST',
        body: JSON.stringify({
          mjml: content,
          recipients: [config.crawler.recipient]
        }),
        headers: {
          'User-Agent': 'mjml-gist-crawler',
          'Content-Type': 'application/json'
        }
      },
      (error, response, body) => {
        if (error) {
          console.log(`Gist ${gistID} not sent`)
          reject()
        } else {
          console.log(`Gist ${gistID} sent`)
          resolve(body)
        }
    })
  })

  return promise
}

const crawl = (since) => {
  debugLogger('Starting to crawl from', since)
  const promise = new Promise((resolve, reject) => {
    readGists(since)
      .then(gists => Promise.all(gists))
      .then(gists => Promise.all(gists.map(gist => readGist(gist))))
      .then(gists => {
        Promise.all(gists.map(gist => {
          sendMJMLEmail(gist.id, gist.files.tryItLive.content)
        }))
      })
      .then(() => {
        setTimeout(() => {
          crawlEmitter.emit('crawl', new Date(since.getTime() + 1*60000))
        }, 0.5*60000)
      })
  })

  return promise
}

crawl(new Date(parseInt(config.crawler.start_date)))
const crawlEmitter = new EventEmitter();
crawlEmitter.on('crawl', (since) => {
  crawl(since)
})
