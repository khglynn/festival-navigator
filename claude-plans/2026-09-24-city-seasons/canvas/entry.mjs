// The canvas's production surface: the app's own modules, bundled read-only
// from the repo, handed to runtime.js as one global. Nothing here renders;
// runtime.js does, through these exports only. `season:data` is the study's
// season file with the venues' own buy links attached (build.mjs, step 0).
import * as state from '../../../js/state.js';
import { FESTIVALS, FESTIVAL_INDEX } from '../../../js/festivals.js';
import * as wall from '../../../js/v3/wall.js';
import * as facts from '../../../js/v3/card-facts.js';
import * as model from '../../../js/v3/model.js';
import * as aura from '../../../js/v3/aura.js';
import * as palette from '../../../js/v3/palette.js';
import * as motion from '../../../js/v3/motion.js';
import * as events from '../../../js/v3/events.js';
import * as now from '../../../js/v3/now.js';
import season from 'season:data';

globalThis.FN = { state, FESTIVALS, FESTIVAL_INDEX, wall, facts, model, aura, palette, motion, events, now, season };
