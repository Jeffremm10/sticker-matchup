// Native In-App Purchase bridge for RevenueCat.
// On native iOS/Android (Capacitor), delegates to @revenuecat/purchases-capacitor.
// On web, returns { webBlocked: true } so callers can show a "Get the mobile app" message.

export type PurchaseResult =
  | { ok: true; productId: string }
  | { ok: false; webBlocked?: true; cancelled?: true; error?: string };

const IOS_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;
const ANDROID_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined;

let configured = false;
let nativeAvailable: boolean | null = null;

async function getNative(): Promise<any | null> {
  if (nativeAvailable === false) return null;
  try {
    // String-literal dynamic imports kept opaque to TS — these packages are only
    // present in the Capacitor native build, not in the Vite web bundle.
    const capName = "@capacitor/core";
    const rcName = "@revenuecat/purchases-capacitor";
    // @ts-ignore - resolved at runtime in native build only
    const cap = (await import(/* @vite-ignore */ capName)).Capacitor;
    if (!cap?.isNativePlatform?.()) {
      nativeAvailable = false;
      return null;
    }
    // @ts-ignore - resolved at runtime in native build only
    const mod: any = await import(/* @vite-ignore */ rcName);
    nativeAvailable = true;
    return { Purchases: mod.Purchases, platform: cap.getPlatform() };
  } catch {
    nativeAvailable = false;
    return null;
  }
}

export async function configureIAP(userId: string) {
  const native = await getNative();
  if (!native) return false;
  if (!configured) {
    const apiKey = native.platform === "ios" ? IOS_KEY : ANDROID_KEY;
    if (!apiKey) return false;
    await native.Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
  } else {
    await native.Purchases.logIn({ appUserID: userId });
  }
  return true;
}

export async function getOfferings(): Promise<Record<string, { price: string }>> {
  const native = await getNative();
  if (!native) return {};
  try {
    const { offerings } = await native.Purchases.getOfferings();
    const map: Record<string, { price: string }> = {};
    const all = offerings?.current?.availablePackages ?? [];
    for (const p of all) {
      map[p.product.identifier] = { price: p.product.priceString };
    }
    return map;
  } catch {
    return {};
  }
}

export async function purchase(productId: string): Promise<PurchaseResult> {
  const native = await getNative();
  if (!native) return { ok: false, webBlocked: true };
  try {
    const { offerings } = await native.Purchases.getOfferings();
    const pkg = (offerings?.current?.availablePackages ?? []).find(
      (p: any) => p.product.identifier === productId
    );
    if (!pkg) return { ok: false, error: "Product not found in offerings" };
    await native.Purchases.purchasePackage({ aPackage: pkg });
    return { ok: true, productId };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: e?.message ?? "Purchase failed" };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  const native = await getNative();
  if (!native) return { ok: false, webBlocked: true };
  try {
    await native.Purchases.restorePurchases();
    return { ok: true, productId: "restored" };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Restore failed" };
  }
}

export async function isNative(): Promise<boolean> {
  return !!(await getNative());
}