import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'
import axios from 'axios'

import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

/* stat */

const { readFile, writeFile, unlink } = require('fs').promises

const Root = () => ''

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const setHeaders = (req, res, next) => {
  res.set('x-skillcrucial-user', '71cfff71-34e1-46eb-95ad-29637d913771')
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next()
}

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser(),
  setHeaders
]

middleware.forEach((it) => server.use(it))

const getUsersData = () => {
  return readFile(`${__dirname}/users.json`, { encoding: 'utf8' })
    .then((text) => {
      return JSON.parse(text)
    })
    .catch(async () => {
      const { data: usersData } = await axios('https://jsonplaceholder.typicode.com/users')
      writeFile(`${__dirname}/users.json`, JSON.stringify(usersData), { encoding: 'utf8' })
      return usersData
    })
}

server.get('/api/v1/users/', async (req, res) => {
  const usersArray = await getUsersData()
  res.json(usersArray)
})

server.post('/api/v1/users/', async (req, res) => {
  const usersArray = await getUsersData()
  const newUser = req.body
  if (usersArray.length === 0) {
    newUser.id = 1
  } else {
    const reg = new RegExp(/\d/)
    const idsArray = usersArray.map((it) => it.id).filter((it) => reg.test(it))
    const lastIdNumber = Math.max(...idsArray)
    newUser.id = lastIdNumber + 1
  }
  const newArray = [...usersArray, newUser]
  writeFile(`${__dirname}/users.json`, JSON.stringify(newArray), { encoding: 'utf8' })
  res.send({ status: 'success', id: newUser.id })
})

server.patch('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  let usersArray = await getUsersData()
  usersArray = usersArray.map((it) => {
    if (it.id === parseInt(userId, 10)) {
      return { ...it, ...req.body }
    }
    return it
  })
  writeFile(`${__dirname}/users.json`, JSON.stringify(usersArray), { encoding: 'utf8' })
  res.json({ status: 'success', id: userId })

  // readFile(`${__dirname}/users.json`, { encoding: 'utf8' }).then(async (text) => {
  //   const arr = JSON.parse(text)
  //   const newArray = [...arr, { id: userId }]
  //   writeFile(`${__dirname}/users.json`, JSON.stringify(newArray), { encoding: 'utf8' })
  //   res.json({ status: 'success', id: userId })
  // })
})

server.delete('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  let usersArray = await getUsersData()
  usersArray = usersArray.filter((it) => it.id !== Number(userId))
  writeFile(`${__dirname}/users.json`, JSON.stringify(usersArray), { encoding: 'utf8' })
  res.json({ status: 'success', id: userId })

  // const { userId } = req.params
  // readFile(`${__dirname}/users.json`, { encoding: 'utf8' }).then(async (text) => {
  //   const arr = JSON.parse(text)
  //   const newArray = arr.filter((it) => it.id !== userId && it.id !== Number(userId))
  //   writeFile(`${__dirname}/users.json`, JSON.stringify(newArray), { encoding: 'utf8' })
  //   res.json({ status: 'success', id: userId })
  // })
})

server.delete('/api/v1/users/', (req, res) => {
  unlink(`${__dirname}/users.json`)
  res.json({ status: 'success' })
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
