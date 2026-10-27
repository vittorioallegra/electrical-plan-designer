import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Menu } from './Menu';

describe('Menu', () => {
  // protects=menu items and separators are direct children of the Radix content (roving focus, typeahead); fails_when=an item is wrapped in another element; no_claim=the look
  it('renders the items as direct children of the menu', async () => {
    render(
      <Menu
        trigger={<button>Open</button>}
        items={[
          { key: 'a', label: 'First', onSelect: () => undefined },
          { key: 'b', label: 'Second', onSelect: () => undefined, separatorBefore: true },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const menu = await screen.findByRole('menu');
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(2);
    for (const item of items) expect(item.parentElement).toBe(menu);
    expect(menu.querySelector('[role="separator"]')?.parentElement).toBe(menu);
  });
});
