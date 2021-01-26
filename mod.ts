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
  #globalWriters: WritableStreamDefaultWriter<Entry<E, keyof E>>[] = [];
  #onWriters: {
    [K in keyof E]?: WritableStreamDefaultWriter<E[K]>[];
  } = {};

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
      if (!this.#listeners[eventName]) {
        this.#listeners[eventName] = [];
      }
      this.#listeners[eventName]!.push({
        once: false,
        cb: listener,
      });
      return this;
    } else {
      if (!this.#onWriters[eventName]) {
        this.#onWriters[eventName] = [];
      }

      const { readable, writable } = new TransformStream<E[K], E[K]>();
      this.#onWriters[eventName]!.push(writable.getWriter());
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
  ): this {
    if (!this.#listeners[eventName]) {
      this.#listeners[eventName] = [];
    }
    this.#listeners[eventName]!.push({
      once: true,
      cb: listener,
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
  ): this {
    if (eventName) {
      if (listener) {
        this.#listeners[eventName] = this.#listeners[eventName]?.filter(
          ({ cb }) => cb !== listener,
        );
      } else {
        delete this.#listeners[eventName];
      }
    } else {
      this.#listeners = {};
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
    for (const { cb, once } of listeners) {
      cb(...args);

      if (once) {
        this.off(eventName, cb);
      }
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
    const { readable, writable } = new TransformStream<
      Entry<E, K>,
      Entry<E, K>
    >();
    this.#globalWriters.push(writable.getWriter());
    return readable[Symbol.asyncIterator]();
  }
}
