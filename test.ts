import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.79.0/testing/asserts.ts";
import { EventEmitter } from "./mod.ts";

type Events = {
  foo: [string];
  bar: [number];
};

Deno.test("on", () => {
  const ee = new EventEmitter<Events>();

  ee.on("foo", (string) => {
    assertEquals(string, "bar");
  });

  ee.emit("foo", "bar");
});

Deno.test("once", () => {
  const ee = new EventEmitter<Events>();

  ee.once("foo", (string) => {
    assertEquals(string, "bar");
  });

  ee.emit("foo", "bar");
});

Deno.test("off", () => {
  const ee = new EventEmitter<Events>();

  function foo() {
    fail();
  }

  ee.on("foo", foo);
  ee.off("foo", foo);

  ee.emit("foo", "bar");
});

Deno.test("offEvent", () => {
  const ee = new EventEmitter<Events>();

  let i = 0;

  ee.on("foo", () => i++);
  ee.on("foo", () => i++);
  ee.off();

  ee.emit("foo", "bar");

  assertEquals(i, 0);
});

Deno.test("offAll", () => {
  const ee = new EventEmitter<Events>();

  let i = 0;

  ee.on("foo", () => i++);
  ee.on("bar", () => i++);
  ee.off();

  ee.emit("foo", "bar");

  assertEquals(i, 0);
});

Deno.test("chainable", () => {
  const ee = new EventEmitter<Events>();

  function foo() {
    fail();
  }

  ee.on("foo", foo).off("foo", foo);

  ee.emit("foo", "bar");
});

Deno.test("asyncIterator", async () => {
  const ee = new EventEmitter<Events>();
  setTimeout(() => {
    ee.emit("foo", "bar");
  }, 100);
  const event = (await ee[Symbol.asyncIterator]().next()).value;

  assertEquals(event.name, "foo");
  assertEquals(event.value, ["bar"]);
});

Deno.test("asyncOn", async () => {
  const ee = new EventEmitter<Events>();
  setTimeout(() => {
    ee.emit("foo", "bar");
  }, 100);
  const value = (await ee.asyncOn("foo").next()).value;

  assertEquals(value, ["bar"]);
});

Deno.test("closeEvent", async () => {
  const ee = new EventEmitter<Events>();
  setTimeout(() => {
    ee.emit("foo", "bar");
  }, 100);

  for await (const _ of ee.asyncOn("foo")) {
    await ee.close("foo");
  }
});

Deno.test("closeGlobal", async () => {
  const ee = new EventEmitter<Events>();
  setTimeout(() => {
    ee.emit("foo", "bar");
  }, 100);

  for await (const _ of ee) {
    await ee.close();
  }
});
