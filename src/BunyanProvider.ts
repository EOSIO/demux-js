import * as Logger from 'bunyan'

/**
 * Provides a configured singleton instance of the `bunyan` logger.
 */
class BunyanProvider {
  /**
   * Retrieve the singleton logger, creating the instance with the currently
   * set configuration if it has not been created or the configuration has
   * changed.
   */
  public static getLogger(): Logger {
    if (!BunyanProvider.loggerInstance) {
      BunyanProvider.loggerInstance = Logger.createLogger(BunyanProvider.config)
    }

    return BunyanProvider.loggerInstance
  }

  /**
   * Set the `bunyan` configuration. Future calls to `getLogger` will return
   * an instance based on this new configureation.
   *
   * @param config The `bunyan` logger configuration object to use
   */
  public static configure(config: Logger.LoggerOptions) {
    BunyanProvider.config = { ...config }
    BunyanProvider.loggerInstance = null
  }

  private static config: Logger.LoggerOptions = {
    name: 'demux'
  }

  private static loggerInstance: Logger | null = null

  private constructor() {}
}

export {
  BunyanProvider,
  Logger
}
