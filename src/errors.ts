// tslint:disable:max-classes-per-file
// Disabling tslint's max classes rule here because it would add a lot of unnecessary separation for simple classes.

export class MismatchedBlockHashError extends Error {
  constructor() {
    super("Block hashes do not match; block not part of current chain.")
    Object.setPrototypeOf(this, MismatchedBlockHashError.prototype)
  }
}

export class MissingHandlerVersionError extends Error {
  constructor() {
    super("Must have at least one handler version.")
    Object.setPrototypeOf(this, MissingHandlerVersionError.prototype)
  }
}

export class DuplicateHandlerVersionError extends Error {
  constructor(versionName: string) {
    super(`Handler version name '${versionName}' already exists. ` +
          "Handler versions must have unique names.")
    Object.setPrototypeOf(this, DuplicateHandlerVersionError.prototype)
  }
}

export class ImproperStartAtBlockError extends Error {
  constructor() {
    super("Cannot seek to block before configured `startAtBlock` number.")
    Object.setPrototypeOf(this, ImproperStartAtBlockError.prototype)
  }
}

export class ImproperSeekToBlockError extends Error {
  constructor(blockNumber: number) {
    super(`Cannot seek to block number ${blockNumber} as it does not exist yet.`)
    Object.setPrototypeOf(this, ImproperSeekToBlockError.prototype)
  }
}

export class ReloadHistoryError extends Error {
  constructor() {
    super("Could not reload history.")
    Object.setPrototypeOf(this, ReloadHistoryError.prototype)
  }
}

export class UnresolvedForkError extends Error {
  constructor() {
    super("Last irreversible block has been passed without resolving fork")
    Object.setPrototypeOf(this, UnresolvedForkError.prototype)
  }
}
