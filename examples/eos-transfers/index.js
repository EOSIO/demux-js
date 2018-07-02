const {
  readers: { NodeosActionReader },
  watchers: { BaseActionWatcher },
  handlers: { BaseActionHandler },
} = require("../../src/")

const updaters = require("./updaters")
const effects = require("./effects")


const actionHandler = new BaseActionHandler({
  state: { volumeBySymbol: {}, totalTransfers: 0 }, // Set initial state
  updaters,
  effects,
})

const actionReader = new NodeosActionReader({
  nodeosEndpoint: "http://api.cypherglass.com:8888", // Thanks CypherGlass!
  startAtBlock: 0, // Start at most recent blocks
})

const actionWatcher = new BaseActionWatcher({
  actionReader,
  actionHandler,
  pollInterval: 500,
})

actionWatcher.watch()
