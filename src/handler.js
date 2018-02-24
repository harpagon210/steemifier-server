'use strict'
import * as sc2 from 'sc2-sdk'
import fetch from 'node-fetch'
import base58 from 'bs58'
import getSlug from 'speakingurl'
import secureRandom from 'secure-random'
import {connectToDatabase} from './db'
import dotenv from 'dotenv'
import Content from './models/Content'
import PackageInfo from '../package.json'

dotenv.config({ path: './variables.env' })

const appId = `steemifier/${PackageInfo.version}`
let sc2Api = sc2.Initialize({
  app: process.env.SC2_APP_ID,
  callbackURL: '',
  accessToken: '',
  scope: []
})

export const create = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false
  if (event.body) {
    const jsonData = JSON.parse(event.body)
    const {contentId, st, yt, title, tags, content, rewardOption} = jsonData

    if (contentId && st && yt && title && tags && content && rewardOption) {
      sc2Api.setAccessToken(st)
      sc2Api.me((err, resp) => {
        if (err) {
          callback(null, {
            'statusCode': 200,
            'body': JSON.stringify(err)
          })
        }

        const username = resp.user
        checkOwnershipContent(jsonData)
          .then(resp => {
            const ret = resp === false ? {'error': `you are not the owner of the content that you are trying to steemify`} : {'response': 'ok'}
            if (resp !== false) {
              const contentOwnerId = resp
              connectToDatabase()
                .then(() => {
                  Content.findOne({ 'contentId': { $in: [contentId] } }, 'steemUsername')
                    .then(cont => {
                      if (cont === null) {
                        const permlink = createPermlink(title, username)
                        postOnSteem(username, title, content, rewardOption, tags, permlink, contentId)
                          .then(resp => {
                            if (resp.error === undefined) {
                              Content.create({
                                'contentId': contentId,
                                'contentOwnerId': contentOwnerId,
                                'steemUsername': username,
                                'steemPermlink': permlink
                              })
                                .then(content => {
                                  let ret = {}
                                  ret.author = content.steemUsername
                                  ret.permlink = content.steemPermlink
                                  callback(null, {
                                    statusCode: 200,
                                    body: JSON.stringify(ret)
                                  })
                                })
                                .catch(err => callback(null, {
                                  statusCode: err.statusCode || 500,
                                  body: JSON.stringify({'error': 'Could not create the content.'})
                                }))
                            }
                          })
                          .catch(err => {
                            callback(null, {
                              'statusCode': 200,
                              'body': JSON.stringify(err)
                            })
                          })
                      } else {
                        callback(null, {
                          statusCode: 200,
                          body: JSON.stringify({'error': 'This content already exists.'})
                        })
                      }
                    })
                })
                .catch(err => {
                  callback(null, {
                    'statusCode': 200,
                    'body': JSON.stringify(err)
                  })
                })
            } else {
              callback(null, {
                'statusCode': 200,
                'body': JSON.stringify(ret)
              })
            }
          })
      })
    } else {
      callback(null, {
        'statusCode': 400,
        'body': ''
      })
    }
  } else {
    callback(null, {
      'statusCode': 400,
      'body': ''
    })
  }
}

export const getOne = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false
  if (event.pathParameters) {
    const contentId = event.pathParameters.id

    if (contentId) {
      connectToDatabase()
        .then(() => {
          Content.findOne({ 'contentId': { $in: [contentId] } }, 'steemUsername steemPermlink')
            .then(content => {
              let ret = {}
              if (content !== null) {
                ret.author = content.steemUsername
                ret.permlink = content.steemPermlink
              } else {
                ret = null
              }
              callback(null, {
                'statusCode': 200,
                'body': JSON.stringify(ret)
              })
            })
        })
        .catch(err => {
          callback(null, {
            'statusCode': 200,
            'body': JSON.stringify(err)
          })
        })
    } else {
      callback(null, {
        'statusCode': 400,
        'body': ''
      })
    }
  } else {
    callback(null, {
      'statusCode': 400,
      'body': ''
    })
  }
}

const checkOwnershipContent = (data) => {
  return new Promise(resolve => {
    const ytApiKey = process.env.YOUTUBE_API_KEY
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${data.contentId}&part=snippet&key=${ytApiKey}`
    fetch(url) // eslint-disable-line no-undef
      .then(response => {
        if (response.ok) {
          return Promise.resolve(response)
        } else {
          return Promise.reject(new Error('Failed to load'))
        }
      })
      .then(response => response.json()) // parse response as JSON
      .then(videoData => {
        // success
        const urlChannel = `https://www.googleapis.com/youtube/v3/channels/?mine=true&part=snippet`
        fetch(urlChannel, { // eslint-disable-line no-undef
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + data.yt
          }
        })
          .then(response => {
            if (response.ok) {
              return Promise.resolve(response)
            } else {
              return Promise.reject(new Error('Failed to load'))
            }
          })
          .then(response => response.json()) // parse response as JSON
          .then(channelData => {
            const videoChannelId = videoData.items[0].snippet.channelId
            const channels = channelData.items.filter(el => el.id === videoChannelId)
            if (channels.length === 1) {
              resolve(videoChannelId)
            } else {
              resolve(false)
            }
          }).catch((error) => {
            console.log(`Error: ${error.message}`)
          })
      })
      .catch((error) => {
        console.log(error)
        console.log(`Error: ${error.message}`)
      })
  })
}

const checkPermLinkLength = (permlink) => {
  if (permlink.length > 255) {
    permlink = permlink.substring(permlink.length - 255, permlink.length)
  }
  // only letters numbers and dashes shall survive
  permlink = permlink.toLowerCase().replace(/[^a-z0-9-]+/g, '')
  return permlink
}

const slug = (text) => {
  return getSlug(text.replace(/[<>]/g, ''), { truncate: 128 })
}

const createPermlink = (title, author) => {
  let permlink
  // posts
  if (title && title.trim() !== '') {
    let s = slug(title)
    if (s === '') {
      s = base58.encode(secureRandom.randomBuffer(4))
    }

    let prefix = `-${base58.encode(secureRandom.randomBuffer(4))}`

    permlink = s + prefix

    return checkPermLinkLength(permlink)
  }
}

const postOnSteem = (
  author,
  title,
  body,
  reward,
  tags,
  permlink,
  contentId
) => {
  const operations = []

  tags = tags.trim().replace(' ', '-').replace('"', '').replace('steemifier', '')
  let tagsArr = tags.split(',').filter((v) => { return v !== '' })
  const arrLength = tagsArr.length
  if (arrLength > 5) {
    tagsArr.splice(4, arrLength - 4)
  }
  tagsArr.push('steemifier')

  const jsonMetadata = {
    'tags': tagsArr,
    'image': [
      `https://i.ytimg.com/vi/${contentId}/maxresdefault.jpg`
    ],
    'links': [
      `https://www.youtube.com/watch?v=${contentId}`
    ],
    'app': appId,
    'format': 'markdown'
  }

  const commentOp = [
    'comment',
    {
      'parent_author': '',
      'parent_permlink': tagsArr[0],
      'author': author,
      'permlink': permlink,
      'title': title,
      'body': body,
      'json_metadata': JSON.stringify(jsonMetadata)
    }
  ]
  operations.push(commentOp)

  const commentOptionsConfig = {
    author,
    permlink,
    allow_votes: true,
    allow_curation_rewards: true,
    max_accepted_payout: '1000000.000 SBD',
    percent_steem_dollars: 10000
  }

  if (reward === '0') {
    commentOptionsConfig.max_accepted_payout = '0.000 SBD'
  } else if (reward === '100') {
    commentOptionsConfig.percent_steem_dollars = 0
  }

  /* commentOptionsConfig.extensions = [
      [
        0,
        {
          beneficiaries: [{ account: referral, weight: 1000 }]
        }
      ]
    ] */

  if (reward === '0' || reward === '100') {
    operations.push(['comment_options', commentOptionsConfig])
  }

  /* if (upvote) {
    operations.push([
      'vote',
      {
        voter: author,
        author,
        permlink,
        weight: 10000
      }
    ])
  } */

  return sc2Api.broadcast(operations)
}
