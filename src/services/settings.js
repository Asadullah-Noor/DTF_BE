import Settings from '../models/Settings.js';

export async function getSettings() {
  return (await Settings.findOne()) || (await Settings.create({}));
}