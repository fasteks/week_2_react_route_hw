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
  res.set('x-skillcrucial-user', '5f9e173c-dd45-41a1-a616-81c5abe6b5ae')
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

server.get('/api/v1/users/', async (req, res) => {
  await readFile(`${__dirname}/users.json`, { encoding: 'utf8' })
    .then((text) => {
      res.json(JSON.parse(text))
    })
    .catch(async () => {
      const { data: usersData } = await axios('https://jsonplaceholder.typicode.com/users')
      await writeFile(`${__dirname}/users.json`, JSON.stringify(usersData), { encoding: 'utf8' })
      res.json(JSON.parse(await readFile(`${__dirname}/users.json`, { encoding: 'utf8' })))
    })
})

server.post('/api/v1/users/', async (req, res) => {
  readFile(`${__dirname}/users.json`, { encoding: 'utf8' }).then((text) => {
    const arr = JSON.parse(text)
    const reg = new RegExp(/\d/)
    const arr1 = arr.map((it) => it.id).filter((it) => reg.test(it))
    const lastIdNumber = Math.max(...arr1) + 1
    const newArray = [...arr, { id: lastIdNumber }]
    writeFile(`${__dirname}/users.json`, JSON.stringify(newArray), { encoding: 'utf8' })
    res.send({ status: 'success', id: lastIdNumber })
  })
})

server.patch('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  readFile(`${__dirname}/users.json`, { encoding: 'utf8' }).then(async (text) => {
    const arr = JSON.parse(text)
    const newArray = [...arr, { id: userId }]
    writeFile(`${__dirname}/users.json`, JSON.stringify(newArray), { encoding: 'utf8' })
    res.json({ status: 'success', id: userId })
  })
})

server.delete('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  readFile(`${__dirname}/users.json`, { encoding: 'utf8' }).then(async (text) => {
    const arr = JSON.parse(text)
    const newArray = arr.filter((it) => it.id !== userId && it.id !== Number(userId))
    writeFile(`${__dirname}/users.json`, JSON.stringify(newArray), { encoding: 'utf8' })
    res.json({ status: 'success', id: userId })
  })
})

server.delete('/api/v1/users/', async (req, res) => {
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
