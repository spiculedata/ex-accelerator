// Runs tasks one at a time, in the order they were asked for. Publishing and withdrawing both change what the node
// pins and what the registry says, so they must not interleave: a withdrawal that landed between a publish's pin and
// its registry row would leave the registry saying "published" for a package that is no longer pinned.

let tail: Promise<unknown> = Promise.resolve();

export function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => undefined); // a failed task must not stop the ones queued behind it
  return run;
}
