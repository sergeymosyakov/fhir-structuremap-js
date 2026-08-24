// Deferred target-list assembly — §7.8.0.8.2's listMode table is itself marked "TODO"
// upstream, so this documents a concrete, tested interpretation rather than guessing
// silently: 'first'/'last' are placement buckets flushed once at the end of a run (so
// rule execution order never affects final placement); 'share'/'single' reuse an
// existing item at the same position for a given listRuleId instead of always
// appending a new one ("shared... up to the first common n items, then create new
// ones").
import { EngineError } from './errors.js';

class ListState {
  first = [];
  middle = [];
  last = [];
  firstClaimedBy = null;
  lastClaimedBy = null;
  shareCursors = new Map(); // listRuleId -> next index into `middle`

  flatten() {
    return [...this.first, ...this.middle, ...this.last];
  }
}

export class ListPlan {
  #states = new Map(); // target array (by reference) -> ListState

  #stateFor(targetArray) {
    let state = this.#states.get(targetArray);
    if (!state) {
      state = new ListState();
      this.#states.set(targetArray, state);
    }
    return state;
  }

  /**
   * Records `value` as a contribution to `targetArray` under the given listMode(s)
   * and listRuleId (for share/single). Returns the item actually stored (may be a
   * pre-existing shared item that `value`'s own properties get merged into).
   */
  add(targetArray, value, listModes, listRuleId, claimant) {
    const state = this.#stateFor(targetArray);
    const modes = listModes ?? [];

    if (modes.includes('share') || modes.includes('single')) {
      const cursor = state.shareCursors.get(listRuleId) ?? 0;
      let existing = state.middle[cursor];
      if (existing === undefined) {
        existing = value;
        state.middle[cursor] = value;
      } else if (value && typeof value === 'object') {
        Object.assign(existing, value);
      }
      state.shareCursors.set(listRuleId, cursor + 1);
      return existing;
    }

    if (modes.includes('first')) {
      if (state.firstClaimedBy && state.firstClaimedBy !== claimant) {
        throw new EngineError('ListPlan: more than one rule claims "first" for the same target list');
      }
      state.firstClaimedBy = claimant;
      state.first.push(value);
      return value;
    }

    if (modes.includes('last')) {
      if (state.lastClaimedBy && state.lastClaimedBy !== claimant) {
        throw new EngineError('ListPlan: more than one rule claims "last" for the same target list');
      }
      state.lastClaimedBy = claimant;
      state.last.push(value);
      return value;
    }

    state.middle.push(value);
    return value;
  }

  /** Writes the assembled (first + middle + last) order back into every tracked array. */
  flush() {
    for (const [targetArray, state] of this.#states) {
      const ordered = state.flatten();
      targetArray.length = 0;
      targetArray.push(...ordered);
    }
  }
}
