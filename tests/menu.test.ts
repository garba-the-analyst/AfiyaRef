import { describe, it, expect, afterEach } from 'vitest';
import { MAIN_MENU, MAIN_MENU_MINI, mainMenu, isMinimalist } from '../src/whatsapp/messageTemplates';

describe('whatsapp menus', () => {
  afterEach(() => {
    delete process.env.WHATSAPP_MODE;
  });

  it('full menu lists all four flows by default', () => {
    expect(mainMenu()).toBe(MAIN_MENU);
    expect(isMinimalist()).toBe(false);
    expect(MAIN_MENU).toMatch(/Inter-Hospital/);
  });

  it('minimalist menu keeps only finder + nurse', () => {
    process.env.WHATSAPP_MODE = 'minimalist';
    expect(mainMenu()).toBe(MAIN_MENU_MINI);
    expect(isMinimalist()).toBe(true);
    expect(MAIN_MENU_MINI).toMatch(/Find nearby hospital/);
    expect(MAIN_MENU_MINI).toMatch(/Nurse Titi/);
    expect(MAIN_MENU_MINI).not.toMatch(/Inter-Hospital/);
    expect(MAIN_MENU_MINI).not.toMatch(/Book Lab/);
  });
});
