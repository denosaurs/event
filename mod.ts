// Copyright 2020-present the denosaurs team. All rights reserved. MIT license.

type Entry<E, K extends keyof E> = {
  name: K;
  value: E[K];
};

export class EventEmitter<E extends Record<string, unknown[]>> {
  #listeners: {
    [K in keyof E]?: Array<{
      once: boolean;
      cb: (...args: E[K]) => void;
    }>;
  } = {};
  #globalListeners: Array<{
    once: boolean;
    cb: <K extends keyof E>(name: K, value: E[K]) => void;
  }> = [];
  #globalWriters: WritableStreamDefaultWriter<Entry<E, keyof E>>[] = [];
  #onWriters: {
    [K in keyof E]?: WritableStreamDefaultWriter<E[K]>[];
  } = {};
  #limit: number;

  /**
   * @param maxListenersPerEvent - if set to 0, no limit is applied. defaults to 10
   */
  constructor(maxListenersPerEvent?: number) {
    this.#limit = maxListenersPerEvent ?? 10;
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
  on<K extends keyof E>(listener: (name: K, value: E[K]) => void): this;
  on<K extends keyof E>(
    eventNameOrListener: K | ((name: K, value: E[K]) => void),
    listener?: (...args: E[K]) => void,
  ): this | AsyncIterableIterator<E[K]> {
    if (typeof eventNameOrListener === "function") {
      if (
        this.#limit !== 0 && this.#globalListeners.length >= this.#limit
      ) {
        throw new TypeError("Listeners limit reached: limit is " + this.#limit);
      }
      this.#globalListeners.push({
        once: false,
        cb: eventNameOrListener,
      });
      return this;
    }

    if (listener) {
      if (!this.#listeners[eventNameOrListener]) {
        this.#listeners[eventNameOrListener] = [];
      }
      if (
        this.#limit !== 0 &&
        this.#listeners[eventNameOrListener]!.length >= this.#limit
      ) {
        throw new TypeError("Listeners limit reached: limit is " + this.#limit);
      }
      this.#listeners[eventNameOrListener]!.push({
        once: false,
        cb: listener,
      });
      return this;
    } else {
      if (!this.#onWriters[eventNameOrListener]) {
        this.#onWriters[eventNameOrListener] = [];
      }
      if (
        this.#limit !== 0 &&
        this.#onWriters[eventNameOrListener]!.length >= this.#limit
      ) {
        throw new TypeError("Listeners limit reached: limit is " + this.#limit);
      }

      const { readable, writable } = new TransformStream<E[K], E[K]>();
      this.#onWriters[eventNameOrListener]!.push(writable.getWriter());
      return readable[Symbol.asyncIterator]();
    }
  }

  /**
   * Adds a one-time listener function for the event named eventName.
   * The next time eventName is emitted, listener is called and then removed.
   */
  once<K extends keyof E>(
    eventName: K,
    listener: (...args: E[K]) => void,
  ): this;
  once<K extends keyof E>(listener: (name: K, value: E[K]) => void): this;
  once<K extends keyof E>(
    eventNameOrListener: K | ((name: K, value: E[K]) => void),
    listener?: (...args: E[K]) => void,
  ): this {
    if (typeof eventNameOrListener === "function") {
      if (
        this.#limit !== 0 && this.#globalListeners.length >= this.#limit
      ) {
        throw new TypeError("Listeners limit reached: limit is " + this.#limit);
      }
      this.#globalListeners.push({
        once: true,
        cb: eventNameOrListener,
      });
      return this;
    }

    if (!this.#listeners[eventNameOrListener]) {
      this.#listeners[eventNameOrListener] = [];
    }
    if (
      this.#limit !== 0 &&
      this.#listeners[eventNameOrListener]!.length >= this.#limit
    ) {
      throw new TypeError("Listeners limit reached: limit is " + this.#limit);
    }
    this.#listeners[eventNameOrListener]!.push({
      once: true,
      cb: listener!,
    });
    return this;
  }

  /**
   * Removes the listener from eventName.
   * If no listener is passed, all listeners will be removed from eventName.
   * If no eventName is passed, all listeners will be removed from the EventEmitter.
   */
  off<K extends keyof E>(
    eventName?: K,
    listener?: (...args: E[K]) => void,
  ): this;
  off<K extends keyof E>(listener: (name: K, value: E[K]) => void): this;
  off<K extends keyof E>(
    eventNameOrListener?: K | ((name: K, value: E[K]) => void),
    listener?: (...args: E[K]) => void,
  ): this {
    if (eventNameOrListener) {
      if (typeof eventNameOrListener === "function") {
        this.#globalListeners = this.#globalListeners?.filter(
          ({ cb }) => cb !== eventNameOrListener,
        );
        return this;
      } else if (listener) {
        this.#listeners[eventNameOrListener] = this
          .#listeners[eventNameOrListener]?.filter(
            ({ cb }) => cb !== listener,
          );
      } else {
        delete this.#listeners[eventNameOrListener];
      }
    } else {
      this.#listeners = {};
      this.#globalListeners = [];
    }
    return this;
  }

  /**
   * Synchronously calls each of the listeners registered for the event named
   * eventName, in the order they were registered, passing the supplied
   * arguments to each.
   */
  async emit<K extends keyof E>(eventName: K, ...args: E[K]): Promise<void> {
    const listeners = this.#listeners[eventName]?.slice() ?? [];
    const globalListeners = this.#globalListeners.slice();
    for (const { cb, once } of listeners) {
      cb(...args);
      if (once) this.off(eventName, cb);
    }
    for (const { cb, once } of globalListeners) {
      cb(eventName, args);
      if (once) this.off(cb);
    }

    if (this.#onWriters[eventName]) {
      for (const writer of this.#onWriters[eventName]!) {
        await writer.write(args);
      }
    }
    for (const writer of this.#globalWriters) {
      await writer.write({
        name: eventName,
        value: args,
      });
    }
  }

  /**
   * Closes async iterators, allowing them to finish and removes listeners.
   * If no eventName is specified, all iterators will be closed,
   * including the iterator for the class.
   */
  async close<K extends keyof E>(eventName?: K): Promise<void> {
    this.off(eventName);

    if (eventName) {
      if (this.#onWriters[eventName]) {
        for (const writer of this.#onWriters[eventName]!) {
          await writer.close();
        }
        delete this.#onWriters[eventName];
      }
    } else {
      for (
        const writers of Object.values(
          this.#onWriters,
        ) as WritableStreamDefaultWriter<E[K]>[][]
      ) {
        for (const writer of writers) {
          await writer.close();
        }
      }
      this.#onWriters = {};

      for (const writer of this.#globalWriters) {
        await writer.close();
      }
      this.#globalWriters = [];
    }
  }

  [Symbol.asyncIterator]<K extends keyof E>(): AsyncIterableIterator<
    { [V in K]: Entry<E, V> }[K]
  > {
    if (this.#limit !== 0 && this.#globalWriters.length >= this.#limit) {
      throw new TypeError("Listeners limit reached: limit is " + this.#limit);
    }

    const { readable, writable } = new TransformStream<
      Entry<E, K>,
      Entry<E, K>
    >();
    this.#globalWriters.push(writable.getWriter());
    return readable[Symbol.asyncIterator]();
  }
}
