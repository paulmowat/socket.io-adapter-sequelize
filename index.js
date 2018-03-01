
var uid2 = require('uid2')
var SocketIOAdapter = require('socket.io-adapter')
var debug = require('debug')('socket.io-sequelize')
var Sequelize = require('sequelize')

var SequelizeOP = Sequelize.Op

function getSocketIoStore (tableName, sequelize) {
  return sequelize.define(tableName, {
    id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    serveruid: {
      type: Sequelize.TEXT
    },
    message: {
      type: Sequelize.TEXT,
      set: function (value) {
        this.setDataValue('message', JSON.stringify(value))
      },
      get: function () {
        return JSON.parse(this.getDataValue('message'))
      }
    },
    opts: {
      type: Sequelize.TEXT,
      set: function (value) {
        this.setDataValue('opts', JSON.stringify(value))
      },
      get: function () {
        return JSON.parse(this.getDataValue('opts'))
      }
    }
  }, {
    tableName: tableName
  })
}

module.exports = function (config, opts) {
  opts = opts || {}

  var tableName = opts.tableName || 'socketiostore'
  var processEvery = opts.processEvery || 1000

  // this server's key
  var serveruid = uid2(6)

  // set error handler
  var errorHandler = function (err) {
    debug(err)
    throw err
  }

  class SequelizeAdapter extends SocketIOAdapter {
    constructor (nsp) {
      super(nsp)
      this.super = Object.getPrototypeOf(Object.getPrototypeOf(this))
      
      setInterval(this.processMessages.bind(this), processEvery)
      process.nextTick(this.processMessages.bind(this))
    }

    async connectIoStore () {
      // Connect to the db as needed
      if (typeof config.Sequelize === 'function') {
        this.sequelize = config
      } else if (config && config.connectionString) {
        this.sequelize = new Sequelize(config.connectionString, config.dialectOptions || {})
      }

      // Get socketIoStore model
      this.socketiostore = getSocketIoStore(tableName, this.sequelize)

      // Create DB if required
      await this.socketiostore.sync()
    }

    async processMessages () {
      
      await this.connectIoStore()

      // Find all the records that are not from this server
      return this.socketiostore.findAll({
        where: {
          'serveruid': {
            [SequelizeOP.ne]: serveruid
          }
        },
        order: ['createdAt']
      })
        .then((records) => {
          debug('Server: ' + serveruid + ' - Found Records ' + records.length)
          // For each of the records emit a message
          records.forEach(record => {
            debug('Server: ' + serveruid + ' - About to broadcast - From Server: ' + record.serveruid + ', Message: ' + JSON.stringify(record.message))
            this.onMessage(null, record.message, record.opts)
          })
          return records
        })
        .map((record) => {
          // Once broadcast then remove the message
          return this.socketiostore.destroy({
            where: {
              id: record.id
            }
          })
        })
        .catch(errorHandler)
    }

    onMessage (pattern, msg, opts) {
      if (msg && msg.nsp === undefined && msg.nsp !== null) {
        msg.nsp = '/'
      }
      if (!msg || msg.nsp !== this.nsp.name) {
        debug('ignore different namespace')
        return
      }
      debug('Server: ' + serveruid + ' - onMessage broadcast: ' + JSON.stringify(msg))
      this.super.broadcast.apply(this, [msg, opts, true])
    }

    async broadcast (packet, opts, remote) {

      await this.connectIoStore()

      this.super.broadcast.call(this, packet, opts)

      if (!remote) {
        if (opts.rooms === undefined) {
          opts.rooms = null
        }
        debug('server ' + serveruid + ' create message  ' + JSON.stringify(packet))
        return this.socketiostore.create({
          serveruid: serveruid,
          message: packet,
          opts: opts
        })
          .catch(errorHandler)
      }
    }
  }

  return SequelizeAdapter
}
