export type EntryBase = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Login = EntryBase & {
  type: 'login';
  username: string;
  password: string;
  previousPassword?: string;
  url?: string;
  packageNames?: string[];
  notes?: string;
  source?: string;
};

export type SecureNote = EntryBase & {
  type: 'note';
  body: string;
};

export type Entry = Login | SecureNote;

export type VaultV1 = {
  version: 1;
  entries: Entry[];
  updatedAt: string;
  deviceId: string;
};
