import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.76.0/testing/asserts.ts";
import EventEmitter from "./mod.ts";

type Events = {
  foo: [string];
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
