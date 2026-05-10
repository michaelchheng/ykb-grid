'use client';

/**
 * useRewardedAd — wraps Google AdSense / Ad Manager rewarded ads.
 *
 * Setup checklist:
 *  1. Apply at https://adsense.google.com (1-7 day approval)
 *  2. Create a "Rewarded" ad unit inside AdSense → My Ads
 *  3. Copy your publisher ID  (ca-pub-XXXXXXXXXXXXXXXX)
 *     and ad slot ID          (XXXXXXXXXX)
 *  4. Add to .env.local:
 *       NEXT_PUBLIC_ADSENSE_PUB_ID=ca-pub-XXXXXXXXXXXXXXXX
 *       NEXT_PUBLIC_ADSENSE_REWARDED_SLOT=XXXXXXXXXX
 *  5. That's it — the Script tag in layout.tsx loads the SDK automatically.
 */

type AdResult = 'rewarded' | 'dismissed' | 'unavailable';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export function useRewardedAd() {
  const pubId   = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID ?? '';
  const slotId  = process.env.NEXT_PUBLIC_ADSENSE_REWARDED_SLOT ?? '';
  const ready   = Boolean(pubId && slotId);

  /**
   * Show a rewarded ad. Returns a promise that resolves when the user earns
   * the reward, or rejects / resolves with 'dismissed' if they skip it.
   */
  function showAd(): Promise<AdResult> {
    return new Promise<AdResult>((resolve) => {
      if (!ready || typeof window === 'undefined' || !window.adsbygoogle) {
        resolve('unavailable');
        return;
      }

      try {
        (window.adsbygoogle as unknown[]).push({
          googletag: {
            display: pubId,
          },
          params: {
            google_ad_client: pubId,
            google_ad_slot: slotId,
            google_ad_format: 'rewarded',
          },
          // Called when the user earns the reward
          callback: () => resolve('rewarded'),
        });
      } catch {
        resolve('unavailable');
      }
    });
  }

  return { ready, showAd };
}
