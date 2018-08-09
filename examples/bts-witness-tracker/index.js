const {
  readers: { bts: { BitsharesActionReader } },
  watchers: { BaseActionWatcher },
} = require("../../dist/")
const ObjectActionHandler = require("./ObjectActionHandler")
const updaters = require("./updaters")
const effects = require("./effects")


const actionHandler = new ObjectActionHandler(
  updaters,
  effects,
)

const actionReader = new BitsharesActionReader(
  "https://api.dex.trading",
  28999264,
)

const actionWatcher = new BaseActionWatcher(
  actionReader,
  actionHandler,
  500,
)

actionWatcher.watch()
