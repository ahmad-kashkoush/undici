const { tspl } = require('@matteo.collina/tspl')
const { test, after } = require('node:test')
const { createServer } = require('node:http')
const { once } = require('node:events')

const { RetryHandler, Client } = require('..')

test('Issue #3288 - request with body (asynciterable)', async t => {
    t = tspl(t, { plan: 6 })
    const server = createServer()
    const dispatchOptions = {
      method: 'POST',
      path: '/',
      headers: {
        'content-type': 'application/json'
      },
      body: (function * () {
        yield 'hello'
        yield 'world'
      })()
    }
  
    server.on('request', (req, res) => {
      res.writeHead(500, {
        'content-type': 'application/json'
      })
  
      res.end('{"message": "failed"}')
    })
  
    server.listen(0, () => {
      const client = new Client(`http://localhost:${server.address().port}`)
      const handler = new RetryHandler(dispatchOptions, {
        dispatch: client.dispatch.bind(client),
        handler: {
          onConnect () {
            t.ok(true, 'pass')
          },
          onBodySent () {
            t.ok(true, 'pass')
          },
          onHeaders (status, _rawHeaders, resume, _statusMessage) {
            t.strictEqual(status, 500)
            return true
          },
          onData (chunk) {
            return true
          },
          onComplete () {
            t.fail()
          },
          onError (err) {
            t.equal(err.message, 'Request failed')
            t.equal(err.statusCode, 500)
            t.equal(err.data.count, 1)
          }
        }
      })
  
      after(async () => {
        await client.close()
        server.close()
  
        await once(server, 'close')
      })
  
      client.dispatch(
        dispatchOptions,
        handler
      )
    })
  
    await t.completed
  })