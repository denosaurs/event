/**
 * # Event
 *
 * Strictly typed event emitter with {@link Symbol.asyncIterator} support.
 *
 * Events should be defined as a literal object type where the key is the event
 * name, and the value is a tuple with any amount of elements of any type.
 *
 * The constructor takes an optional argument which defines the maximum amount of
 * listeners per event, which defaults to 10. If this limit is surpassed, an error
 * is thrown.
 *
 * ---
 *
 * > ⚠️ Events must be a type, and can't be an interface due to their design
 * > differences.
 *
 * ---
 *
 * @example
 *
 * ```ts
 * type Events = {
 *   foo: [string];
 *   bar: [number, boolean];
 * };
 *
 * class MyClass extends EventEmitter<Events> {}
 * const MyClassInstance = new MyClass();
 *
 * function listener(num, bool) {}
 *
 * // add a listener to the bar event
 * MyClassInstance.on("bar", listener);
 *
 * // remove a listener from the bar event
 * MyClassInstance.off("bar", listener);
 *
 * // remove all listeners from the bar event
 * MyClassInstance.off("bar");
 *
 * // remove all listeners from the event emitter
 * MyClassInstance.off();
 *
 * // add a one-time listener to the bar event
 * MyClassInstance.once("bar", listener);
 *
 * // on, once, and off are chainable
 * MyClassInstance.on("bar", listener).off("bar", listener);
 *
 * // emit the bar event with the wanted data
 * MyClassInstance.emit("bar", 42, true);
 *
 * // listen to all events with an async iterator
 * for await (const event of MyClassInstance) {
 *   if (event.name === "bar") {
 *     // event.value is of type [number, boolean]
 *   }
 * }
 *
 * // listen to a specific event with an async iterator
 * for await (const [num, bool] of MyClassInstance.on("bar")) {
 * }
 *
 * // removes all listeners and closes async iterators
 * MyClassInstance.close("bar");
 * ```
 *
 * @module
 */

// Copyright 2020-present the denosaurs team. All rights reserved. MIT license.

type Entry<E, K extends keyof E> = {
  name: K;
  value: E[K];
};

const isNullish = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

/**
 * Strictly typed event emitter base class with {@link Symbol.asyncIterator} support.
 * 
 * @example
 *
 * ```ts
 * type Events = {
 *   foo: [string];
 *   bar: [number, boolean];
 * };
 *
 * class MyClass extends EventEmitter<Events> {}
 * const MyClassInstance = new MyClass();
 *
 * function listener(num, bool) {}
 *
 * // add a listener to the bar event
 * MyClassInstance.on("bar", listener);
 *
 * // remove a listener from the bar event
 * MyClassInstance.off("bar", listener);
 *
 * // remove all listeners from the bar event
 * MyClassInstance.off("bar");
 *
 * // remove all listeners from the event emitter
 * MyClassInstance.off();
 *
 * // add a one-time listener to the bar event
 * MyClassInstance.once("bar", listener);
 *
 * // on, once, and off are chainable
 * MyClassInstance.on("bar", listener).off("bar", listener);
 *
 * // emit the bar event with the wanted data
 * MyClassInstance.emit("bar", 42, true);
 *
 * // listen to all events with an async iterator
 * for await (const event of MyClassInstance) {
 *   if (event.name === "bar") {
 *     // event.value is of type [number, boolean]
 *   }
 * }
 *
 * // listen to a specific event with an async iterator
 * for await (const [num, bool] of MyClassInstance.on("bar")) {
 * }
 *
 * // removes all listeners and closes async iterators
 * MyClassInstance.close("bar");
 * ```
 */
export class EventEmitter<E extends Record<string, unknown[]>> {
  private listeners: {
    [K in keyof E]?: Array<{
      once: boolean;
      cb: (...args: E[K]) => void;
    }>;
  } = {};
  private globalWriters: WritableStreamDefaultWriter<Entry<E, keyof E>>[] = [];
  private onWriters: {
    [K in keyof E]?: WritableStreamDefaultWriter<E[K]>[];
  } = {};
  private limit: number;

  /**
   * @param maxListenersPerEvent - if set to 0, no limit is applied. defaults to 10
   */
  constructor(maxListenersPerEvent?: number) {
    this.limit = maxListenersPerEvent ?? 10;
  }

  /**
   * Appends the listener to the listeners array of the corresponding eventName.
   * No checks are made if the listener was already added, so adding multiple
   * listeners will result in the listener being called multiple times.
   * If no listener is passed, it returns an asyncIterator which will fire
   * every time eventName is emitted.
   */
  on<K extends keyof E>(eventName: K, listener: (...args: E[K]) => void): this;
  on<K extends keyof E>(eventName: K): AsyncIterableIterator<E[K]>;
  on<K extends keyof E>(
    eventName: K,
    listener?: (...args: E[K]) => void,
  ): this | AsyncIterableIterator<E[K]> {
    if (listener) {
      if (!this.listeners[eventName]) {
        this.listeners[eventName] = [];
      }
      if (
        this.limit !== 0 &&
        this.listeners[eventName]!.length >= this.limit
      ) {
        throw new TypeError("Listeners limit reached: limit is " + this.limit);
      }
      this.listeners[eventName]!.push({
        once: false,
        cb: listener,
      });
      return this;
    } else {
      if (!this.onWriters[eventName]) {
        this.onWriters[eventName] = [];
      }
      if (
        this.limit !== 0 &&
        this.onWriters[eventName]!.length >= this.limit
      ) {
        throw new TypeError("Listeners limit reached: limit is " + this.limit);
      }

      const { readable, writable } = new TransformStream<E[K], E[K]>();
      this.onWriters[eventName]!.push(writable.getWriter());
      return readable[Symbol.asyncIterator]();
    }
  }

  /**
   * Adds a one-time listener function for the event named eventName.
   * The next time eventName is emitted, listener is called and then removed.
   * If no listener is passed, it returns a Promise that will resolve once
   * eventName is emitted.
   */
  once<K extends keyof E>(
    eventName: K,
    listener: (...args: E[K]) => void,
  ): this;
  once<K extends keyof E>(eventName: K): Promise<E[K]>;
  once<K extends keyof E>(
    eventName: K,
    listener?: (...args: E[K]) => void,
  ): this | Promise<E[K]> {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    if (
      this.limit !== 0 &&
      this.listeners[eventName]!.length >= this.limit
    ) {
      throw new TypeError("Listeners limit reached: limit is " + this.limit);
    }
    if (listener) {
      this.listeners[eventName]!.push({
        once: true,
        cb: listener,
      });
      return this;
    } else {
      return new Promise((res) => {
        this.listeners[eventName]!.push({
          once: true,
          cb: (...args) => res(args),
        });
      });
    }
  }

  /**
   * Removes the listener from eventName.
   * If no listener is passed, all listeners will be removed from eventName,
   * this includes async listeners.
   * If no eventName is passed, all listeners will be removed from the EventEmitter,
   * including the async iterator for the class
   */
  async off<K extends keyof E>(
    eventName?: K,
    listener?: (...args: E[K]) => void,
  ): Promise<this> {
    if (!isNullish(eventName)) {
      if (listener) {
        this.listeners[eventName] = this.listeners[eventName]?.filter(
          ({ cb }) => cb !== listener,
        );
      } else {
        if (this.onWriters[eventName]) {
          for (const writer of this.onWriters[eventName]!) {
            await writer.close();
          }
          delete this.onWriters[eventName];
        }

        delete this.listeners[eventName];
      }
    } else {
      for (
        const writers of Object.values(
          this.onWriters,
        ) as WritableStreamDefaultWriter<E[K]>[][]
      ) {
        for (const writer of writers) {
          await writer.close();
        }
      }
      this.onWriters = {};

      for (const writer of this.globalWriters) {
        await writer.close();
      }

      this.globalWriters = [];
      this.listeners = {};
    }
    return this;
  }

  /**
   * Synchronously calls each of the listeners registered for the event named
   * eventName, in the order they were registered, passing the supplied
   * arguments to each.
   */
  async emit<K extends keyof E>(eventName: K, ...args: E[K]): Promise<void> {
    const listeners = this.listeners[eventName]?.slice() ?? [];
    for (const { cb, once } of listeners) {
      cb(...args);

      if (once) {
        this.off(eventName, cb);
      }
    }

    if (this.onWriters[eventName]) {
      for (const writer of this.onWriters[eventName]!) {
        await writer.write(args);
      }
    }
    for (const writer of this.globalWriters) {
      await writer.write({
        name: eventName,
        value: args,
      });
    }
  }

  [Symbol.asyncIterator]<K extends keyof E>(): AsyncIterableIterator<
    { [V in K]: Entry<E, V> }[K]
  > {
    if (this.limit !== 0 && this.globalWriters.length >= this.limit) {
      throw new TypeError("Listeners limit reached: limit is " + this.limit);
    }

    const { readable, writable } = new TransformStream<
      Entry<E, K>,
      Entry<E, K>
    >();
    this.globalWriters.push(writable.getWriter());
    return readable[Symbol.asyncIterator]();
  }
}
