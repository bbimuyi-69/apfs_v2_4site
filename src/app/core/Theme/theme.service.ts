// theme.service.ts
import { Injectable } from '@angular/core';
import { ApfsTheme, APFS_THEME_STORAGE_KEY } from './theme.model';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private readonly hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

    private mediaQuery: MediaQueryList | null =
        this.hasDom ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    private currentTheme: ApfsTheme = 'system';

    constructor() {
        const stored = this.safeGetStoredTheme();
        this.currentTheme = stored ?? 'system';
        this.applyTheme(this.currentTheme);

        this.attachSystemThemeListener();
    }

    get theme(): ApfsTheme {
        return this.currentTheme;
    }

    /** The theme actually applied (resolves system) */
    get resolvedTheme(): 'light' | 'dark' {
        if (this.currentTheme === 'system') {
            return this.mediaQuery?.matches ? 'dark' : 'light';
        }
        return this.currentTheme;
    }

    setTheme(theme: ApfsTheme): void {
        this.currentTheme = theme;
        this.safeStoreTheme(theme);
        this.applyTheme(theme);
    }

    cycleTheme(): void {
        const next: ApfsTheme =
            this.currentTheme === 'light' ? 'dark' :
                this.currentTheme === 'dark' ? 'system' :
                    'light';

        this.setTheme(next);
    }

    private applyTheme(theme: ApfsTheme): void {
        if (!this.hasDom) return;

        const resolved: 'light' | 'dark' =
            theme === 'system'
                ? (this.mediaQuery?.matches ? 'dark' : 'light')
                : theme;

        document.body.setAttribute('data-theme', resolved);
    }

    private safeGetStoredTheme(): ApfsTheme | null {
        if (!this.hasDom) return null;
        try {
            const stored = localStorage.getItem(APFS_THEME_STORAGE_KEY) as ApfsTheme | null;
            return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : null;
        } catch {
            return null;
        }
    }

    private safeStoreTheme(theme: ApfsTheme): void {
        if (!this.hasDom) return;
        try {
            localStorage.setItem(APFS_THEME_STORAGE_KEY, theme);
        } catch {
            // ignore (private browsing / storage disabled)
        }
    }

    private attachSystemThemeListener(): void {
        if (!this.mediaQuery) return;

        const handler = () => {
            if (this.currentTheme === 'system') this.applyTheme('system');
        };

        // Modern
        if (typeof this.mediaQuery.addEventListener === 'function') {
            this.mediaQuery.addEventListener('change', handler);
            return;
        }

        // Legacy fallback
        // eslint-disable-next-line deprecation/deprecation
        if (typeof (this.mediaQuery as any).addListener === 'function') {
            // eslint-disable-next-line deprecation/deprecation
            (this.mediaQuery as any).addListener(handler);
        }
    }
}
