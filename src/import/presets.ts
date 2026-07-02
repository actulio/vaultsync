export type Mapping = {
  title?: string;
  url?: string;
  username?: string;
  password?: string;
  notes?: string;
  type?: 'login' | 'note';
};

export type Preset = { name: string; mapping: Mapping; sample?: string[] };

export const PRESETS: Preset[] = [
  {
    name: '1Password',
    mapping: { title: 'Title', url: 'URL', username: 'Username', password: 'Password', notes: 'Notes' },
  },
  {
    name: 'LastPass',
    mapping: { title: 'name', url: 'url', username: 'username', password: 'password', notes: 'extra' },
  },
  {
    name: 'Bitwarden',
    mapping: { title: 'name', url: 'login_uri', username: 'login_username', password: 'login_password', notes: 'notes' },
  },
  {
    name: 'Chrome',
    mapping: { title: 'name', url: 'url', username: 'username', password: 'password' },
  },
];
