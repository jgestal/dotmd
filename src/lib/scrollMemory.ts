// Where each tab was scrolled to, per view (source / preview), so switching tabs comes back to
// the same place. Positions are kept for the session only.
import { app } from './state.svelte';

const memory = new Map<string, number>();
const key = (view: 'source' | 'preview') => `${app.tabs[app.activeTab]?.id ?? 'none'}:${view}`;

export const rememberScroll = (view: 'source' | 'preview', top: number) => memory.set(key(view), top);
export const recallScroll = (view: 'source' | 'preview') => memory.get(key(view)) ?? 0;
