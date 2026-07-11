/** Shared by the server (which broadcasts) and the dashboard (which listens). */
export const elderChannel = (elderId: string) => `elder-${elderId}`;
export const SESSION_ENDED = "session_ended";
