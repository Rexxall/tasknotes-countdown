// Talk to the demo Obsidian instance over the DevTools port.
//   node cdp.mjs eval "<js>"          evaluate in the main window, print the JSON result
//   node cdp.mjs shot <file.png>      save a screenshot of the main window
//   node cdp.mjs shot2x <file.png>    same, at twice the pixels (for the README demo)
//   node cdp.mjs click "<x> <y>"      a real mouse click at CSS px
// PORT defaults to 9351 (the port open.sh uses).
const port = process.env.PORT || "9351";
const [cmd, arg] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
// WIN=Settings picks the settings window (a separate window since Obsidian 1.15); default is the main window.
const pages = list.filter((t) => t.type === "page" && !t.url.startsWith("devtools"));
const page = process.env.WIN ? pages.find((t) => (t.title.startsWith(process.env.WIN) || (process.env.WIN === "Settings" && t.title.startsWith("设置")))) : pages.find((t) => !t.title.startsWith("Settings") && !t.title.startsWith("设置")) || pages[0];
if (!page) { console.error("no Obsidian window on port " + port); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
const call = (method, params) => new Promise((resolve) => {
  const id = Math.floor(Math.random() * 1e9);
  const onMsg = (e) => { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener("message", onMsg); resolve(m); } };
  ws.addEventListener("message", onMsg);
  ws.send(JSON.stringify({ id, method, params }));
});
setTimeout(() => { console.error("timeout"); process.exit(1); }, 60000);
if (cmd === "eval") {
  const m = await call("Runtime.evaluate", { expression: arg, awaitPromise: true, returnByValue: true, userGesture: true });
  const r = m.result;
  console.log(JSON.stringify(r?.exceptionDetails ? r.exceptionDetails.exception?.description : r?.result?.value, null, 1));
} else if (cmd === "shot") {
  const m = await call("Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.writeFileSync(arg, Buffer.from(m.result.data, "base64"));
  console.log(arg);
} else if (cmd === "shot2x") {
  const { width, height } = (await call("Runtime.evaluate", { expression: "({width: innerWidth, height: innerHeight})", returnByValue: true })).result.result.value;
  const m = await call("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 2 } });
  const fs = await import("node:fs");
  fs.writeFileSync(arg, Buffer.from(m.result.data, "base64"));
  console.log(arg);
} else if (cmd === "click") {
  const [x, y] = arg.split(/\s+/).map(Number);
  await call("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await call("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 1, clickCount: 1 });
} else {
  console.error("usage: node cdp.mjs eval <js> | shot <file> | shot2x <file> | click \"<x> <y>\"");
  process.exit(2);
}
process.exit(0);
