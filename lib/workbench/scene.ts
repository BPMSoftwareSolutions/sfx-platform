/* Identity shapes the estate compiler emits.
 *
 * A capability or view identifier reaches the resolver from a URL, so each is
 * constrained to the shape before it is used. The circuit itself is derived
 * from selected database authority by the estate service; nothing is lowered
 * here and no compiled product is read.
 */
export const isCapabilityId = (value: string) => /^[a-z0-9][a-z0-9-]{0,127}$/.test(value);
export const isViewId = (value: string) => /^n-[0-9a-f]{24}$/.test(value);
