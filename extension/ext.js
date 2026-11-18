// The extension APIs. Firefox (and Safari) provide them as `browser`; Chrome and Edge as `chrome`.
// Both return promises in Manifest V3, so the rest of the code uses one name for all of them.
/** @type {typeof chrome} */
export const ext = /** @type {any} */ (globalThis).browser ?? globalThis.chrome;
