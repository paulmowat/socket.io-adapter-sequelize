const Sequelize = require('sequelize')
const http = require('http').Server
const io = require('socket.io')
const ioc = require('socket.io-client')
const expect = require('chai').expect
const SequelizeAdapter = require('../')

describe('socket.io-sequelize', function () {
  it('broadcasts', function (done) {
    create(function (server1, client1) {
      console.log('server 1, client 1')
      create(function (server2, client2) {
        console.log('server 2, client 2')
        client1.on('woot', function (a, b) {
          console.log('client 1 recieved woot')
          expect(a).to.eql([])
          expect(b).to.eql({ a: 'b' })
          done()
        })
        client1.on('error', done)
        server2.on('error', done)
        server2.on('connection', function (c2) {
          c2.broadcast.emit('woot', [], { a: 'b' })
          console.log('server 2 woot to client 1')
        })
      })
    })
  })

  // Create a pair of socket.io server+client
  function create (nsp, fn) {    
    // Create http server and link socket.io
    const srv = http()
    const sio = io(srv)
    // Set db options
    const dbconfig = {
      'database': 'test-db',
      'username': 'user',
      'password': 'pass',
      'dialect': 'sqlite',
      'storage': 'test/test-db.sqlite',
      logging: false
    }
    // Create a connection for the scheduler
    const sequelize = new Sequelize(dbconfig)
    // Set sequelize adapter
    sio.adapter(SequelizeAdapter(sequelize))
    // Listen
    srv.listen(function (err) {
      if (err) throw err // abort tests
      if (typeof nsp === 'function') {
        fn = nsp
        nsp = ''
      }
      nsp = nsp || '/'
      const addr = srv.address()
      const url = 'http://localhost:' + addr.port + nsp
      fn(sio.of(nsp), ioc(url))
    })
  }
})
