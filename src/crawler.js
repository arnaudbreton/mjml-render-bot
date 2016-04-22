import request from 'request'
import debug from 'debug'
import EventEmitter from 'events'
import config from './config'
const debugLogger = debug('mjml-gist-crawler')

const readGists = (since) => {
    debugLogger(`Gist loading...`)
    debugLogger(`https://api.github.com/users/mjml-tryitlive/gists?access_token==${config.crawler.gist_token}&&since=${since.toISOString()}`)
    const promise = new Promise((resolve, reject) => {
      let gistContent = ''
      request(
        {
          url: `https://api.github.com/users/mjml-tryitlive/gists?access_token=${config.crawler.gist_token}&since=${since.toISOString()}`,
          method: 'GET',
          headers: {
            'User-Agent': 'mjml-gist-crawler'
          }
        },
        (error, response, body) => {
          if (error) {
            debugLogger(`Gist loaded with error ${error}`)
            reject()
          } else {
            resolve(JSON.parse(body))
          }
      })
    })

    return promise
}

const readGist = (gist) => {
  debugLogger(`Gist loading ${gist.id}...`)
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
          debugLogger(`Gist ${gist.id} loaded with error ${error}`)
          reject()
        } else {
          debugLogger(`Gist ${gist.id} loaded successfully`)
          console.log(body)
          resolve(JSON.parse(body))
        }
    })
  })

  return promise
}

const sendMJMLEmail = (content) => {
  console.log(`Sending ${content} over email`)
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
          debugLogger(`Gist not sent`)
          reject()
        } else {
          debugLogger(`Gist sent`)
          resolve(body)
        }
    })
  })

  return promise
}

const crawl = (since) => {
  const promise = new Promise((resolve, reject) => {
    readGists(since)
      .then(gists => Promise.all(gists))
      .then(gists => Promise.all(gists.map(gist => readGist(gist))))
      .then(gists => {
        Promise.all(gists.map(gist => {
          sendMJMLEmail(gist.files.tryItLive.content)
        }))
      })
      .then(() => {
        setTimeout(() => {
          myEmitter.emit('crawl', new Date(since.getTime() + 10*60000))
        }, 0.5*60000)
      })
  })

  return promise
}

crawl(new Date(config.crawler.start_date))
const myEmitter = new EventEmitter();
myEmitter.on('crawl', (since) => {
  crawl(since)
})
