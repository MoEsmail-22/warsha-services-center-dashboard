/**
 * setTimeout / clearTimeout driven by a Web Worker.
 *
 * When a tab is in the background or minimized, Chrome slows the page's own timers to about
 * once a minute, so a 3-second check could take a minute. Timers inside a worker aren't slowed
 * that way, so the worker counts the time and tells the page when to run.
 * Falls back to the normal timers if workers aren't available.
 */
const WORKER_SOURCE = `
  const timers = new Map();
  self.onmessage = ({ data }) => {
    if (data.type === 'set') {
      timers.set(data.id, setTimeout(() => {
        timers.delete(data.id);
        self.postMessage(data.id);
      }, data.ms));
    } else if (data.type === 'clear') {
      clearTimeout(timers.get(data.id));
      timers.delete(data.id);
    }
  };
`;

let worker;
let nextId = 1;
const callbacks = new Map();

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = ({ data: id }) => {
      const callback = callbacks.get(id);
      callbacks.delete(id);
      callback?.();
    };
  } catch {
    worker = null; // e.g. blocked by the browser → normal timers
  }
  return worker;
}

/** Like setTimeout, but keeps its pace while the tab is in the background. */
export function backgroundTimeout(callback, ms) {
  const timerWorker = getWorker();
  if (!timerWorker) return { native: setTimeout(callback, ms) };

  const id = nextId++;
  callbacks.set(id, callback);
  timerWorker.postMessage({ type: 'set', id, ms });
  return { id };
}

export function clearBackgroundTimeout(handle) {
  if (!handle) return;
  if (handle.native !== undefined) {
    clearTimeout(handle.native);
    return;
  }
  callbacks.delete(handle.id);
  worker?.postMessage({ type: 'clear', id: handle.id });
}
