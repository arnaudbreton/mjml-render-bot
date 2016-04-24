import request from 'request'
import debug from 'debug'
import EventEmitter from 'events'
import config from './config'
import Redis from 'ioredis'
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
  const promise = new Promise((resolveRead, rejectRead) => {
    redisClient.get(gist.id)
    .then((lastCrawled) => {
        if (lastCrawled) {
          resolveRead({
            id: gist.id,
            ignored: true
          })
        }
        else {
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
                rejectRead()
              } else {
                console.log(`Gist ${gist.id} loaded successfully`)

                debugLogger(`Tagging gist ${gist.id} in Redis, expiring in ${config.crawler.gist_expiration_tag} seconds`)
                redisClient.set(gist.id, (new Date()).getTime())
                redisClient.expire(gist.id, config.crawler.gist_expiration_tag)

                resolveRead(JSON.parse(body))
              }
          })
        }
    })
  })

  return promise
}

const sendMJMLEmail = (gistID, content) => {
  console.log(`Sending ${gistID} over email`)
  debugLogger(`Sending ${content} over email`)
  const promise = new Promise((resolve, reject) => {
    resolve()
    return
    request(
      {
        url: `${config.crawler.api_base_url}/render-send-email`,
        method: 'POST',
        body: JSON.stringify({
          mjml: content,
          recipients: [config.crawler.recipient],
          gistID: gistID
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
  console.log('Starting to crawl from', since)
  const promise = new Promise((resolve, reject) => {
    readGists(since)
      .then(gists => Promise.all(gists))
      .then(gists => Promise.all(gists.map(gist => readGist(gist))))
      .then(gists => {
        Promise.all(gists.map(gist => {
          if (!gist.ignored) {
            sendMJMLEmail(gist.id, gist.files.tryItLive.content)
          }
          else {
            console.log("Ignoring Gist", gist.id)
          }
        }))
      })
      .then(() => {
        console.log(`Crawling done for ${since}, storing last start date to Redis`)
        redisClient.set('start_date', since.getTime())
        setTimeout(() => {
          crawlEmitter.emit('crawl', new Date(since.getTime() + 1*60000))
        }, 1*60000)
      })
  })

  return promise
}

debugLogger('Connecting to Redis', config.crawler.redis_url)
const redisClient = new Redis()
const crawlEmitter = new EventEmitter();
redisClient.get('start_date').then((lastStartDate) => {
  debugLogger('Read start_date from Redis', lastStartDate)
  const startDate = lastStartDate || config.crawler.start_date

  crawl(new Date(parseInt(startDate)))
  crawlEmitter.on('crawl', (since) => {
    crawl(since)
  })
})
