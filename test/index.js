var Sequelize = require('sequelize')
var http = require('http').Server;
var io = require('socket.io');
var ioc = require('socket.io-client');
var expect = require('chai').expect;
var adapter = require('../');

describe('socket.io-sequelize', function () {

  it('broadcasts', function(done){
    create(function(server1, client1){
      console.log('server 1, client 1')
      create(function(server2, client2){
        console.log('server 2, client 2')
        client1.on('woot', function(a, b){
          console.log('client 1 recieved woot')
          expect(a).to.eql([]);
          expect(b).to.eql({ a: 'b' });
          done();
        });
        client1.on('error', done);
        server2.on('error', done);
        server2.on('connection', function(c2){
          c2.broadcast.emit('woot', [], { a: 'b' });
          console.log('server 2 woot to client 1')
        });
      });
    });
  });

  // create a pair of socket.io server+client
  function create(nsp, fn){

    const dbconfig = {
      'database': 'test-db',
      'username': 'user',
      'password': 'pass',            
      'dialect': 'sqlite',
      'storage': 'test/test-db.sqlite',
      logging: false
    }

    var srv = http();
    var sio = io(srv);
      // create a connection for the scheduler
    const sequelize = new Sequelize(dbconfig)
    sio.adapter(adapter(sequelize));
    srv.listen(function(err){
      if (err) throw err; // abort tests
      if ('function' == typeof nsp) {
        fn = nsp;
        nsp = '';
      }
      nsp = nsp || '/';
      var addr = srv.address();
      var url = 'http://localhost:' + addr.port + nsp;
      fn(sio.of(nsp), ioc(url));
    });
  }

});