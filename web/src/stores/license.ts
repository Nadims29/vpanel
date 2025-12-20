import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as licenseApi from '@/api/license';
import type { LicenseInfo } from '@/api/license';

interface LicenseState {
  // License info
  license: LicenseInfo | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchLicense: () => Promise<void>;
  activateLicense: (licenseKey: string) => Promise<void>;
  deactivateLicense: () => Promise<void>;
  refreshLicense: () => Promise<void>;
  clearError: () => void;

  // Helpers
  isPro: () => boolean;
  isEnterprise: () => boolean;
  hasFeature: (feature: string) => boolean;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      license: null,
      loading: false,
      error: null,
      lastFetched: null,

      fetchLicense: async () => {
        const { lastFetched } = get();
        const now = Date.now();

        // Skip fetch if recently fetched
        if (lastFetched && now - lastFetched < CACHE_DURATION) {
          return;
        }

        try {
          set({ loading: true, error: null });
          const license = await licenseApi.getLicenseInfo();
          set({ license, loading: false, lastFetched: now });
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch license',
          });
        }
      },

      activateLicense: async (licenseKey: string) => {
        try {
          set({ loading: true, error: null });
          const license = await licenseApi.activateLicense(licenseKey);
          set({ license, loading: false, lastFetched: Date.now() });
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to activate license',
          });
          throw err;
        }
      },

      deactivateLicense: async () => {
        try {
          set({ loading: true, error: null });
          await licenseApi.deactivateLicense();
          set({
            license: {
              is_pro: false,
              is_enterprise: false,
              plan: 'free',
              features: [],
              days_remaining: 0,
              max_users: 0,
              max_servers: 0,
            },
            loading: false,
            lastFetched: Date.now(),
          });
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to deactivate license',
          });
          throw err;
        }
      },

      refreshLicense: async () => {
        try {
          set({ loading: true, error: null });
          const license = await licenseApi.refreshLicense();
          set({ license, loading: false, lastFetched: Date.now() });
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to refresh license',
          });
          throw err;
        }
      },

      clearError: () => set({ error: null }),

      isPro: () => {
        const { license } = get();
        return license?.is_pro || license?.is_enterprise || false;
      },

      isEnterprise: () => {
        const { license } = get();
        return license?.is_enterprise || false;
      },

      hasFeature: (feature: string) => {
        const { license } = get();
        if (!license) return false;
        if (!license.is_pro && !license.is_enterprise) return false;
        if (license.features.includes('*')) return true;
        return license.features.includes(feature);
      },
    }),
    {
      name: 'vpanel-license',
      partialize: (state) => ({
        license: state.license,
        lastFetched: state.lastFetched,
      }),
    }
  )
);

