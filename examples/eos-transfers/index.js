const {
  readers: { NodeosActionReader },
  watchers: { BaseActionWatcher },
} = require("../../dist/")
const ObjectActionHandler = require("./ObjectActionHandler")
const updaters = require("./updaters")
const effects = require("./effects")

const request = require("request-promise-native")

const actionHandler = new ObjectActionHandler({
  updaters,
  effects,
})

const actionReader = new NodeosActionReader(
  "http://api.cypherglass.com:8888", // Thanks CypherGlass!
  0, // Start at most recent blocks
  false,
  600,
  request,
)

const actionWatcher = new BaseActionWatcher({
  actionReader,
  actionHandler,
  pollInterval: 500,
})

actionWatcher.watch()
