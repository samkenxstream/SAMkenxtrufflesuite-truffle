import WebSocket from "isomorphic-ws";

import { DashboardMessageBusClientOptions } from "./types";

import { Message } from "@truffle/dashboard-message-bus";

import {
  connectToMessageBusWithRetries,
  createMessage,
  getMessageBusPorts,
  sendAndAwait,
  MessageBusConnectionError
} from "@truffle/dashboard-message-bus";
import { isPromise } from "util/types";

interface SendAndWaitArgs<M extends Message> {
  type: M["type"];
  payload: M["payload"];
}

export class DashboardMessageBusClient {
  private static _singletonInstance: DashboardMessageBusClient | null;
  private _options: DashboardMessageBusClientOptions;
  private _socket: WebSocket;
  private _outstandingTasks: Map<Promise<any>, true> = new Map<
    Promise<any>,
    true
  >();

  private constructor(options: DashboardMessageBusClientOptions) {
    this._options = options || {
      host: "localhost",
      port: 24012
    };
  }

  static getSingletonInstance(options: DashboardMessageBusClientOptions) {
    if (!DashboardMessageBusClient._singletonInstance) {
      const instanceProxyHandler: ProxyHandler<DashboardMessageBusClient> = {
        get: (target, p) => {
          const prop: any = (target as any)[p];
          if (typeof prop === "function") {
            return target.wrapFunction(prop);
          }
          return prop;
        }
      };

      const constructorProxyHandler: ProxyHandler<
        typeof DashboardMessageBusClient
      > = {
        construct: (target, args) => {
          const newTarget = new DashboardMessageBusClient(
            args[0]
          ) as DashboardMessageBusClient;
          return new Proxy(newTarget, instanceProxyHandler);
        }
      };

      const ProxiedDashboardMessageBusClient = new Proxy(
        DashboardMessageBusClient,
        constructorProxyHandler
      );

      DashboardMessageBusClient._singletonInstance =
        new ProxiedDashboardMessageBusClient(options);
    }

    return DashboardMessageBusClient._singletonInstance;
  }

  async sendAndAwait<M extends Message>({
    type,
    payload
  }: SendAndWaitArgs<M>): Promise<void> {
    try {
      const socket = await this._getSocket();
      const message = createMessage<M>(type, payload);

      await sendAndAwait(socket, message);
    } catch (err) {
      if (!(err instanceof MessageBusConnectionError)) {
        throw err;
      }
    }
  }

  private async _getSocket(): Promise<WebSocket> {
    if (this._socket) {
      return this._socket;
    }

    const { publishPort } = await getMessageBusPorts(
      this._options.port,
      this._options.host
    );

    this._socket = await connectToMessageBusWithRetries(
      publishPort,
      this._options.host
    );

    return this._socket;
  }

  private wrapFunction(f: Function): (...args: any[]) => Promise<unknown> {
    return ((...args: any[]) => {
      const returnValue = f(...args);

      if (isPromise(returnValue)) {
        this._outstandingTasks.set(returnValue, true);

        return returnValue
          .then(val => {
            this._outstandingTasks.delete(returnValue);
            return val;
          })
          .catch(err => {
            this._outstandingTasks.delete(returnValue);
            throw err;
          });
      }
      return returnValue;
    }).bind(this);
  }

  async waitForOutstandingTasks(): Promise<void> {
    await Promise.all(this._outstandingTasks);
  }
}
