import * as Logger from 'bunyan'
import { LogLevel } from 'bunyan'
import { LogOptions } from './interfaces'

/**
 * Provides a configured singleton instance of the `bunyan` logger.
 */
class BunyanProvider {
  /**
   * Create an return a 'child' logger of the root Bunyan logger. The root logger
   * is created on the first call to `getLogger` using the current set configuration.
   * Subsequent calls to `configure` will be ignored.
   *
   * @param logOptions The source name and log level for the child logger
   */
  public static getLogger(logOptions: LogOptions): Logger {
    if (!BunyanProvider.loggerInstance) {
      BunyanProvider.loggerInstance = Logger.createLogger(BunyanProvider.rootConfig)
    }

    return BunyanProvider.loggerInstance.child(
      {
        source: logOptions.logSource || 'undefined',
        level: logOptions.logLevel || 'info' as LogLevel,
      }, false)
  }

  /**
   * Set the `bunyan` configuration. This may be called multiple times,
   * with each call replacing the previously set configuration. However
   * after the first call to `getLogger` the root logger will be created
   * and further calls to `configure` will be ignore, with a logged warning.
   *
   * @param rootConfig The `bunyan` logger configuration object to use for
   *                   the root logger
   */
  public static configure(rootConfig: Logger.LoggerOptions) {
    if (BunyanProvider.loggerInstance) {
      BunyanProvider.loggerInstance.warn({ source: 'BunyanProvider'})
    }
    BunyanProvider.rootConfig = {
      ...BunyanProvider.defaultConfig,
      ...rootConfig,
    }
    BunyanProvider.loggerInstance = null
  }

  private static defaultConfig: Logger.LoggerOptions = {
    source: 'demux',
    name: 'demux',
  }

  private static rootConfig: Logger.LoggerOptions = BunyanProvider.defaultConfig

  private static loggerInstance: Logger | null = null

  private constructor() {}
}

export {
  BunyanProvider,
  Logger,
  LogLevel,
}
