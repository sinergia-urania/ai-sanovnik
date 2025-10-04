// File: src/store/journalStore.js
import { create } from 'zustand';

let _id = 1;

export const useJournalStore = create((set, get) => ({
  entries: [],
  addEntry: ({ title = '', content = '' }) =>
    set((state) => ({
      entries: [{ id: _id++, title, content, date: Date.now() }, ...state.entries],
    })),
  updateEntry: (entry) =>
    set((state) => ({
      entries: state.entries.map(e => (e.id === entry.id ? { ...e, ...entry } : e)),
    })),
  removeEntry: (id) =>
    set((state) => ({ entries: state.entries.filter(e => e.id !== id) })),
}));
