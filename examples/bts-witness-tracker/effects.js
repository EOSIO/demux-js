function logWitnessCreation(state, payload, blockInfo, context) {
  console.info(`Witness ${payload.result.data} created.`)
  console.info(`${state.witnesses.size} witnesses registered so far:\n`, JSON.stringify(...state.witnesses, null, 2))
}

const effects = [
  {
    actionType: "witness_create",
    effect: logWitnessCreation,
  },
]

module.exports = effects
