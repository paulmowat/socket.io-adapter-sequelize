
const uid2 = require('uid2')
const SocketIOAdapter = require('socket.io-adapter')
const debug = require('debug')('socket.io-sequelize')

module.exports = function (sequelize, opts) {
  opts = opts || {}

  // Deal with options
  const tableName = opts.tableName || 'socketiostore'
  const processEvery = opts.processEvery || 1000

  // Create a unqiue server's key
  const serveruid = uid2(6)

  // Fetch the sequelize class from the sequelize connection
  const Sequelize = sequelize.Sequelize

  // Set NE Alias to allow backwards compatability
  const neAlias = (Sequelize.Op !== undefined) ? Sequelize.Op.ne : '$ne'

  // set error handler
  const errorHandler = function (err) {
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
      // Build/Fetch the socketIoStore model
      this.socketiostore = this.getSocketIoStore(tableName, sequelize)

      // Create DB table if required
      await this.socketiostore.sync()
    }

    getSocketIoStore (tableName, sequelize) {
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

    async processMessages () {
      // Connect to IO Store
      await this.connectIoStore()

      // Find all the records that are not from this server.
      return this.socketiostore.findAll({
        where: {
          'serveruid': {
            [neAlias]: serveruid
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
          // Once message has been broadcasted then it can be removed
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
      // Broadcast the message to remote servers
      debug('Server: ' + serveruid + ' - onMessage broadcast: ' + JSON.stringify(msg))
      this.super.broadcast.apply(this, [msg, opts, true])
    }

    async broadcast (packet, opts, remote) {
      await this.connectIoStore()

      this.super.broadcast.call(this, packet, opts)

      // If this is not a remote server then we need to create the message, so it can then be broadcasted them
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
