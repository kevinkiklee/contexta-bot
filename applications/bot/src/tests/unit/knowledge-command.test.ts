import { describe, it, expect } from 'vitest';
import { data } from '../../commands/knowledge.js';

describe('/knowledge command registration', () => {
  it('has the correct name', () => {
    const json = data.toJSON();
    expect(json.name).toBe('knowledge');
  });

  it('has search, delete, and correct subcommands', () => {
    const json = data.toJSON();
    const subcommands = json.options?.map((o: any) => o.name) ?? [];
    expect(subcommands).toContain('search');
    expect(subcommands).toContain('delete');
    expect(subcommands).toContain('correct');
  });
});
