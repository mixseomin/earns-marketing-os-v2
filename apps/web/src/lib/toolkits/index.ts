// Toolkit barrel — import side-effect to populate registry.
// Worker daemon + cron routes import this để ensure tools registered before invoke.
//
// Add new toolkit module here khi ship Phase 12 squads:
//   import './publisher';
//   import './creative';
//   import './analytics';

import './research';

export { RESEARCH_TOOLKIT_LOADED } from './research';
