export const mobileBubbleBottom = (aboveTrip: boolean) => aboveTrip ? 164 : 88;
/** Bottom padding a mobile scroll area needs so its last content can scroll clear of the floating button. */
export const mobileSupportClearance = (aboveTrip: boolean) => `calc(${mobileBubbleBottom(aboveTrip) + 48 + 16}px + env(safe-area-inset-bottom, 0px))`;
