function logUpdate(state, payload, blockInfo, context) {
  console.info("State updated:\n", JSON.stringify(state, null, 2))
}

const effects = [
  {
    actionType: "eosio.token::transfer",
    effect: logUpdate,
  },
]

module.exports = effects
