import { nanoid } from 'nanoid';

export type IdGenerator = () => string;

export const newId: IdGenerator = () => nanoid(12);
