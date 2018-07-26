const {
  readers: { eos: { MongoActionReader } },
  watchers: { BaseActionWatcher },
} = require("../../dist/")
const ObjectActionHandler = require("./ObjectActionHandler")
const updaters = require("./updaters")
const effects = require("./effects")


const actionHandler = new ObjectActionHandler(
  updaters,
  effects,
)

const actionReader = new MongoActionReader(
  "mongodb://127.0.0.1:27017",
  0,
)

// If using MongoActionReader you need to call
actionReader.initialize()
  .then(() => {
    const actionWatcher = new BaseActionWatcher(
      actionReader,
      actionHandler,
      500,
    )

    actionWatcher.watch()
  })

// const actionWatcher = new BaseActionWatcher(
//   actionReader,
//   actionHandler,
//   500,
// )

// actionWatcher.watch()

