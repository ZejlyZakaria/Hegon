export type CommandModule = 'tasks' | 'goals' | 'habits' | 'journal' | 'books';

export interface CommandResult {
  id:       string;
  module:   CommandModule;
  title:    string;
  subtitle?: string;
  href:     string;
}
