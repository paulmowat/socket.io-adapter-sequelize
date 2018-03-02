# socket.io-adapter-sequelize

## Install
```
npm install socket.io-adapter-sequelize
```

## How to use

```js
var io = require('socket.io')(3000);
var SequelizeAdapter = require('socket.io-adapter-sequelize');

var dbconfig = {
      'database': 'test-db',
      'username': 'user',
      'password': 'pass',            
      'dialect': 'sqlite',
      'storage': 'test/test-db.sqlite',
      'logging': false
    }

var sequelize = new Sequelize(dbconfig)
io.adapter(SequelizeAdapter(sequelize));
```

## API

### adapter(sequelize[, opts])

`sequelize` is a existing connection to a seqeulize database or an object that contains a `connectionString` and `dialectOptions` property according to the sequelize documentation.

### adapter(opts)

The following options are allowed:

- `tableName`: the name of the table that will be created and used within your connected database
- `processEvery`: milliseconds for how often the check for new messages will be run. defaults to 1000 i.e. 1 second.

## When to use

Use when you want to use a sequelize compatable database to pass events between nodes when working with clusters.  

## Credit

Inspired by the other socket.io adapters. Particularly the redis and rethinkdb ones. Thanks

## License

MIT