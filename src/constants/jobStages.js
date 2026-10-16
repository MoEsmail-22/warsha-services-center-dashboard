/**
 * Job stages: where the car is on the workshop floor (the Jobs Board columns).
 * This is the workshop's side; bookingStatus ("Confirmed", …) is the customer's side.
 *
 * PATCH /Workshop/bookings/{id}/status takes the stage NUMBER and only allows one step at
 * a time (the backend answers "Invalid transition: New → InProgress" for a skipped step).
 *
 * ⚠ The numbers are an assumption until the backend confirms them. They match the order of
 *   GET /Workshop/jobs-board (new, diagnosing, inProgress, ready) and that error message.
 *   If the backend sends a different order, only STAGE_NUMBER needs to change.
 */

/** The Jobs Board columns, in order. "diagnosing" is shown as "Confirmed". */
export const JOB_STAGES = ['new', 'diagnosing', 'in_progress', 'ready'];

export const STAGE_NUMBER = {
  new: 1,
  diagnosing: 2,
  in_progress: 3,
  ready: 4,
  completed: 5,
};

/** Every stage in order, Completed last (the drawer can move a job there). */
const STAGE_ORDER = ['new', 'diagnosing', 'in_progress', 'ready', 'completed'];

/**
 * The requests needed to move from one stage to another. The backend only accepts one step
 * forward at a time, so a jump forward becomes each step in order
 * (new → in_progress = ['diagnosing', 'in_progress']). A move back, or from an unknown
 * stage, is one direct request; the backend decides if it's allowed.
 */
export function stagesBetween(from, to) {
  const fromIndex = STAGE_ORDER.indexOf(from);
  const toIndex = STAGE_ORDER.indexOf(to);
  if (fromIndex < 0 || toIndex <= fromIndex) return [to];
  return STAGE_ORDER.slice(fromIndex + 1, toIndex + 1);
}

/** GET /Workshop/jobs-board group names → our stage keys. */
export const STAGE_BY_BOARD_KEY = {
  new: 'new',
  diagnosing: 'diagnosing',
  inProgress: 'in_progress',
  ready: 'ready',
};
